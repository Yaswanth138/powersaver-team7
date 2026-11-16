import uuid
from typing import List
from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PropertyCreate, PropertyResponse, MeterCreate, MeterResponse

router = APIRouter(prefix="/api/properties", tags=["Properties & Meters"])


@router.get("", response_model=List[PropertyResponse])
def get_all_properties():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM properties ORDER BY created_at ASC")
        rows = cursor.fetchall()
        return [
            PropertyResponse(
                id=r["id"],
                name=r["name"],
                property_type=r["property_type"],
                sanctioned_load_kw=r["sanctioned_load_kw"],
                created_at=r["created_at"]
            )
            for r in rows
        ]


@router.post("", response_model=PropertyResponse, status_code=201)
def create_property(prop: PropertyCreate):
    prop_id = f"prop_{uuid.uuid4().hex[:8]}"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO properties (id, name, property_type, sanctioned_load_kw)
            VALUES (?, ?, ?, ?)
        """, (prop_id, prop.name, prop.property_type, prop.sanctioned_load_kw))

        # Automatically create default grid meter
        meter_id = f"meter_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO meters (id, property_id, meter_number, meter_type)
            VALUES (?, ?, ?, 'grid')
        """, (meter_id, prop_id, f"MTR-{uuid.uuid4().hex[:6].upper()}"))

        cursor.execute("SELECT * FROM properties WHERE id = ?", (prop_id,))
        row = cursor.fetchone()

        return PropertyResponse(
            id=row["id"],
            name=row["name"],
            property_type=row["property_type"],
            sanctioned_load_kw=row["sanctioned_load_kw"],
            created_at=row["created_at"]
        )


@router.get("/{property_id}/meters", response_model=List[MeterResponse])
def get_property_meters(property_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM meters WHERE property_id = ? ORDER BY created_at ASC", (property_id,))
        rows = cursor.fetchall()
        return [
            MeterResponse(
                id=r["id"],
                property_id=r["property_id"],
                meter_number=r["meter_number"],
                meter_type=r["meter_type"],
                created_at=r["created_at"]
            )
            for r in rows
        ]


@router.post("/{property_id}/meters", response_model=MeterResponse, status_code=201)
def add_meter(property_id: str, meter: MeterCreate):
    meter_id = f"meter_{uuid.uuid4().hex[:8]}"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO meters (id, property_id, meter_number, meter_type)
            VALUES (?, ?, ?, ?)
        """, (meter_id, property_id, meter.meter_number, meter.meter_type))

        cursor.execute("SELECT * FROM meters WHERE id = ?", (meter_id,))
        row = cursor.fetchone()

        return MeterResponse(
            id=row["id"],
            property_id=row["property_id"],
            meter_number=row["meter_number"],
            meter_type=row["meter_type"],
            created_at=row["created_at"]
        )
