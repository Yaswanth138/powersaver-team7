import uuid
from datetime import datetime
from fastapi import HTTPException
from ..database import get_db
from ..models import ReadingCreate, ReadingResponse


def record_reading(reading_data: ReadingCreate) -> ReadingResponse:
    meter_id = reading_data.meter_id
    reading_date_str = reading_data.reading_date
    cumulative_kwh = reading_data.cumulative_kwh

    try:
        curr_date = datetime.strptime(reading_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if meter exists
        cursor.execute("SELECT id, property_id FROM meters WHERE id = ?", (meter_id,))
        meter_row = cursor.fetchone()
        if not meter_row:
            raise HTTPException(status_code=404, detail="Meter not found.")
        property_id = meter_row["property_id"]

        # Check for previous reading immediately prior to this date
        cursor.execute("""
            SELECT reading_date, cumulative_kwh 
            FROM readings 
            WHERE meter_id = ? AND reading_date < ?
            ORDER BY reading_date DESC 
            LIMIT 1
        """, (meter_id, reading_date_str))
        prev_reading = cursor.fetchone()

        # Check for subsequent reading after this date
        cursor.execute("""
            SELECT reading_date, cumulative_kwh 
            FROM readings 
            WHERE meter_id = ? AND reading_date > ?
            ORDER BY reading_date ASC 
            LIMIT 1
        """, (meter_id, reading_date_str))
        next_reading = cursor.fetchone()

        # Strict validation: cumulative readings cannot go backwards
        if prev_reading and cumulative_kwh < prev_reading["cumulative_kwh"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid reading: {cumulative_kwh} kWh is lower than previous reading ({prev_reading['cumulative_kwh']} kWh on {prev_reading['reading_date']})."
            )

        if next_reading and cumulative_kwh > next_reading["cumulative_kwh"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid reading: {cumulative_kwh} kWh is higher than next reading ({next_reading['cumulative_kwh']} kWh on {next_reading['reading_date']})."
            )

        # Calculate daily consumption delta
        if prev_reading:
            prev_date = datetime.strptime(prev_reading["reading_date"], "%Y-%m-%d").date()
            days_elapsed = (curr_date - prev_date).days
            days_elapsed = max(1, days_elapsed)
            delta_kwh = cumulative_kwh - prev_reading["cumulative_kwh"]
            daily_kwh = round(delta_kwh / days_elapsed, 2)

            # Check for gap alert
            if days_elapsed > 3:
                cursor.execute("""
                    INSERT INTO alerts (id, property_id, meter_id, alert_type, severity, message, reading_date)
                    VALUES (?, ?, ?, 'missing_reading', 'LOW', ?, ?)
                """, (
                    f"alert_{uuid.uuid4().hex[:8]}",
                    property_id,
                    meter_id,
                    f"Notice: A gap of {days_elapsed} days was detected between readings. Daily averages were normalized.",
                    reading_date_str
                ))
        else:
            days_elapsed = 1
            daily_kwh = 0.0  # Initial baseline entry

        # Insert or replace reading
        reading_id = f"read_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO readings (id, meter_id, reading_date, cumulative_kwh, daily_consumption_kwh, days_elapsed, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(meter_id, reading_date) DO UPDATE SET
                cumulative_kwh=excluded.cumulative_kwh,
                daily_consumption_kwh=excluded.daily_consumption_kwh,
                days_elapsed=excluded.days_elapsed,
                notes=excluded.notes
        """, (
            reading_id,
            meter_id,
            reading_date_str,
            cumulative_kwh,
            daily_kwh,
            days_elapsed,
            reading_data.notes
        ))

        # Re-fetch the saved record
        cursor.execute("SELECT * FROM readings WHERE meter_id = ? AND reading_date = ?", (meter_id, reading_date_str))
        saved = cursor.fetchone()

        return ReadingResponse(
            id=saved["id"],
            meter_id=saved["meter_id"],
            reading_date=saved["reading_date"],
            cumulative_kwh=saved["cumulative_kwh"],
            daily_consumption_kwh=saved["daily_consumption_kwh"],
            days_elapsed=saved["days_elapsed"],
            is_estimated=bool(saved["is_estimated"]),
            notes=saved["notes"],
            created_at=saved["created_at"]
        )


def list_readings(meter_id: str, limit: int = 100):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM readings 
            WHERE meter_id = ? 
            ORDER BY reading_date ASC 
            LIMIT ?
        """, (meter_id, limit))
        rows = cursor.fetchall()

        return [
            ReadingResponse(
                id=r["id"],
                meter_id=r["meter_id"],
                reading_date=r["reading_date"],
                cumulative_kwh=r["cumulative_kwh"],
                daily_consumption_kwh=r["daily_consumption_kwh"],
                days_elapsed=r["days_elapsed"],
                is_estimated=bool(r["is_estimated"]),
                notes=r["notes"],
                created_at=r["created_at"]
            )
            for r in rows
        ]
