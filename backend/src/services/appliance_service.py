import uuid
from typing import List
from ..database import get_db
from ..models import ApplianceCreate, ApplianceResponse, ApplianceSummaryResponse


def add_appliance(data: ApplianceCreate) -> ApplianceResponse:
    appliance_id = f"app_{uuid.uuid4().hex[:8]}"
    daily_kwh = round((data.rated_wattage * data.daily_hours_used * data.quantity) / 1000.0, 2)
    monthly_kwh = round(daily_kwh * 30.0, 2)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO appliances (id, property_id, name, rated_wattage, daily_hours_used, quantity, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            appliance_id,
            data.property_id,
            data.name,
            data.rated_wattage,
            data.daily_hours_used,
            data.quantity,
            data.category
        ))

    return ApplianceResponse(
        id=appliance_id,
        property_id=data.property_id,
        name=data.name,
        rated_wattage=data.rated_wattage,
        daily_hours_used=data.daily_hours_used,
        quantity=data.quantity,
        category=data.category,
        estimated_daily_kwh=daily_kwh,
        estimated_monthly_kwh=monthly_kwh
    )


def get_appliances_summary(property_id: str) -> ApplianceSummaryResponse:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM appliances WHERE property_id = ? ORDER BY category, name", (property_id,))
        rows = cursor.fetchall()

    appliances: List[ApplianceResponse] = []
    total_daily = 0.0
    category_map = {}

    for r in rows:
        daily_kwh = round((r["rated_wattage"] * r["daily_hours_used"] * r["quantity"]) / 1000.0, 2)
        monthly_kwh = round(daily_kwh * 30.0, 2)
        total_daily += daily_kwh

        cat = r["category"] or "general"
        category_map[cat] = round(category_map.get(cat, 0.0) + monthly_kwh, 2)

        appliances.append(ApplianceResponse(
            id=r["id"],
            property_id=r["property_id"],
            name=r["name"],
            rated_wattage=r["rated_wattage"],
            daily_hours_used=r["daily_hours_used"],
            quantity=r["quantity"],
            category=cat,
            estimated_daily_kwh=daily_kwh,
            estimated_monthly_kwh=monthly_kwh
        ))

    total_monthly = round(total_daily * 30.0, 2)

    return ApplianceSummaryResponse(
        appliances=appliances,
        total_estimated_daily_kwh=round(total_daily, 2),
        total_estimated_monthly_kwh=total_monthly,
        category_breakdown=category_map
    )
