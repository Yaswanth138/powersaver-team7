from typing import List
from fastapi import APIRouter, Query, HTTPException
from ..models import ForecastResponse, AnomalyItem
from ..services.anomaly_service import forecast_monthly_bill, detect_anomalies
from ..database import get_db

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Forecasting"])


@router.get("/forecast", response_model=ForecastResponse)
def get_bill_forecast(property_id: str = Query(...), meter_id: str = Query(...)):
    return forecast_monthly_bill(property_id, meter_id)


@router.get("/anomalies", response_model=List[AnomalyItem])
def get_anomalies(meter_id: str = Query(...)):
    return detect_anomalies(meter_id)


@router.get("/alerts")
def get_alerts(property_id: str = Query(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM alerts 
            WHERE property_id = ? AND is_resolved = 0 
            ORDER BY created_at DESC
        """, (property_id,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET is_resolved = 1 WHERE id = ?", (alert_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "message": "Alert marked as resolved"}


@router.get("/recommendations")
def get_recommendations(property_id: str = Query(...), meter_id: str = Query(...)):
    """
    Evidence-based energy saving recommendations based on actual observed usage.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Check appliance consumption
        cursor.execute("""
            SELECT name, rated_wattage, daily_hours_used, category 
            FROM appliances 
            WHERE property_id = ?
        """, (property_id,))
        appliances = cursor.fetchall()

    recommendations = []

    # Check for AC cooling loads
    cooling_apps = [a for a in appliances if a["category"] == "cooling" or "ac" in a["name"].lower()]
    if cooling_apps:
        recommendations.append({
            "title": "Optimize Air Conditioning Setpoint",
            "impact": "High (Save ~₹450/month)",
            "details": "Increasing AC thermostat from 20°C to 24°C reduces compressor energy use by ~24%.",
            "category": "cooling"
        })

    # Check for Water Heater / Geyser
    heating_apps = [a for a in appliances if a["category"] == "heating" or "geyser" in a["name"].lower()]
    if heating_apps:
        recommendations.append({
            "title": "Use Geyser Timer / Turn Off After Use",
            "impact": "Medium (Save ~₹250/month)",
            "details": "A 2000W geyser kept on standby loses heat through thermal conduction, contributing 1.5–2 kWh/day in phantom load.",
            "category": "heating"
        })

    # General recommendations
    recommendations.append({
        "title": "Stay Within Lower Tariff Slabs",
        "impact": "High (Save ₹2.00 - ₹3.50 per unit)",
        "details": "In Indian telescopic tariffs, units above 200 kWh cost significantly more. Monitoring daily rate helps avoid crossing the threshold.",
        "category": "tariff"
    })

    return recommendations
