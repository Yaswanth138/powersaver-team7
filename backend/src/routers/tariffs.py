import uuid
from typing import List
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import TariffPlanCreate, BillCalculationResponse
from ..services.tariff_engine import calculate_bill_for_property, calculate_slab_bill

router = APIRouter(prefix="/api/tariffs", tags=["Tariffs & Bill Calculation"])


@router.get("/{property_id}")
def get_property_tariff(property_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tariff_plans WHERE property_id = ?", (property_id,))
        plan = cursor.fetchone()

        if not plan:
            # Return default
            cursor.execute("SELECT * FROM tariff_plans WHERE id = 'tariff_default'")
            plan = cursor.fetchone()

        plan_id = plan["id"]
        cursor.execute("SELECT * FROM tariff_slabs WHERE plan_id = ? ORDER BY min_units ASC", (plan_id,))
        slabs = cursor.fetchall()

    return {
        "plan_id": plan["id"],
        "property_id": property_id,
        "discom_name": plan["discom_name"],
        "fixed_charge_per_kw": plan["fixed_charge_per_kw"],
        "tax_percentage": plan["tax_percentage"],
        "slabs": [dict(s) for s in slabs]
    }


@router.put("/{property_id}")
def update_property_tariff(property_id: str, plan_data: TariffPlanCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tariff_plans WHERE property_id = ?", (property_id,))
        existing = cursor.fetchone()

        if existing:
            plan_id = existing["id"]
            cursor.execute("""
                UPDATE tariff_plans 
                SET discom_name = ?, fixed_charge_per_kw = ?, tax_percentage = ?
                WHERE id = ?
            """, (plan_data.discom_name, plan_data.fixed_charge_per_kw, plan_data.tax_percentage, plan_id))
            cursor.execute("DELETE FROM tariff_slabs WHERE plan_id = ?", (plan_id,))
        else:
            plan_id = f"tariff_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO tariff_plans (id, property_id, discom_name, fixed_charge_per_kw, tax_percentage)
                VALUES (?, ?, ?, ?, ?)
            """, (plan_id, property_id, plan_data.discom_name, plan_data.fixed_charge_per_kw, plan_data.tax_percentage))

        # Insert new slabs
        for s in plan_data.slabs:
            slab_id = f"slab_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO tariff_slabs (id, plan_id, min_units, max_units, rate_per_unit)
                VALUES (?, ?, ?, ?, ?)
            """, (slab_id, plan_id, s.min_units, s.max_units, s.rate_per_unit))

    return {"status": "success", "message": "Tariff plan and slabs updated successfully"}


@router.post("/calculate", response_model=BillCalculationResponse)
def calculate_bill(property_id: str = Query(...), total_units: float = Query(...)):
    return calculate_bill_for_property(property_id, total_units)
