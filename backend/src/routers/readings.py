from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException
from ..models import ReadingCreate, ReadingResponse
from ..services.reading_service import record_reading, list_readings
from ..database import get_db

router = APIRouter(prefix="/api/readings", tags=["Meter Readings"])


@router.post("", response_model=ReadingResponse, status_code=201)
def log_reading(data: ReadingCreate):
    return record_reading(data)


@router.get("", response_model=List[ReadingResponse])
def get_readings(meter_id: str = Query(..., description="Meter identifier"), limit: int = 100):
    return list_readings(meter_id, limit)


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
