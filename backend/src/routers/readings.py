from typing import List, Optional
import io
import csv
from fastapi import APIRouter, Query, HTTPException, Response
from ..models import ReadingCreate, ReadingResponse
from ..services.reading_service import record_reading, list_readings, compare_historical_usage
from ..database import get_db

router = APIRouter(prefix="/api/readings", tags=["Meter Readings"])


@router.post("", response_model=ReadingResponse, status_code=201)
def log_reading(data: ReadingCreate):
    return record_reading(data)


@router.post("/bulk", status_code=201)
def bulk_log_readings(readings: List[ReadingCreate]):
    results = []
    for r in sorted(readings, key=lambda x: x.reading_date):
        results.append(record_reading(r))
    return {"status": "success", "imported_count": len(results)}


@router.get("", response_model=List[ReadingResponse])
def get_readings(meter_id: str = Query(..., description="Meter identifier"), limit: int = 100):
    return list_readings(meter_id, limit)


@router.get("/compare")
def get_historical_comparison(meter_id: str = Query(..., description="Meter identifier")):
    """
    Comparison with the same property's historical usage (Month-over-Month & Week-over-Week).
    """
    return compare_historical_usage(meter_id)


@router.get("/export")
def export_readings_csv(meter_id: str = Query(..., description="Meter identifier")):
    """
    Exports all meter readings as downloadable CSV.
    """
    readings = list_readings(meter_id, limit=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Meter ID", "Date", "Cumulative kWh", "Daily Consumption kWh", "Days Elapsed", "Notes"])

    for r in readings:
        writer.writerow([r.id, r.meter_id, r.reading_date, r.cumulative_kwh, r.daily_consumption_kwh, r.days_elapsed, r.notes or ""])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=readings_{meter_id}.csv"}
    )



@router.get("/trends")
def get_consumption_trends(meter_id: str = Query(..., description="Meter identifier")):
    """
    Returns structured timeseries data for Recharts:
    - daily bars
    - monthly aggregations
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Daily records
        cursor.execute("""
            SELECT reading_date, daily_consumption_kwh, cumulative_kwh, days_elapsed, is_estimated
            FROM readings 
            WHERE meter_id = ?
            ORDER BY reading_date ASC
        """, (meter_id,))
        daily_rows = cursor.fetchall()

        # Monthly aggregation
        cursor.execute("""
            SELECT 
                SUBSTR(reading_date, 1, 7) as month,
                ROUND(SUM(daily_consumption_kwh), 2) as total_units,
                COUNT(*) as readings_count
            FROM readings
            WHERE meter_id = ?
            GROUP BY SUBSTR(reading_date, 1, 7)
            ORDER BY month ASC
        """, (meter_id,))
        monthly_rows = cursor.fetchall()

    return {
        "daily": [dict(r) for r in daily_rows],
        "monthly": [dict(r) for r in monthly_rows]
    }
