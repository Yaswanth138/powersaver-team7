import math
import statistics
from datetime import datetime, date
import calendar
from typing import List, Dict, Any
from ..database import get_db
from ..models import AnomalyItem, ForecastResponse
from .tariff_engine import calculate_bill_for_property


def detect_anomalies(meter_id: str, threshold_z: float = 2.0) -> List[AnomalyItem]:
    """
    Applies statistical anomaly detection using Modified Z-score (Median & MAD)
    on daily consumption deltas.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT reading_date, daily_consumption_kwh 
            FROM readings 
            WHERE meter_id = ? AND daily_consumption_kwh > 0
            ORDER BY reading_date ASC
        """, (meter_id,))
        records = cursor.fetchall()

    if len(records) < 5:
        # Need at least 5 readings to establish a baseline
        return []

    values = [r["daily_consumption_kwh"] for r in records]
    med = statistics.median(values)
    abs_deviations = [abs(v - med) for v in values]
    mad = statistics.median(abs_deviations)

    anomalies: List[AnomalyItem] = []

    # If MAD is near zero (e.g. constant readings), use standard deviation
    if mad == 0:
        std = statistics.stdev(values) if len(values) > 1 else 1.0
        mad = std * 0.6745 if std > 0 else 1.0

    for r in records:
        val = r["daily_consumption_kwh"]
        # Modified Z-score formula
        mod_z = 0.6745 * (val - med) / mad

        if mod_z >= threshold_z:
            severity = "HIGH" if mod_z > 3.0 else "MEDIUM"
            pct_above = round(((val - med) / med) * 100, 1) if med > 0 else 0
            anomalies.append(AnomalyItem(
                reading_date=r["reading_date"],
                consumption_kwh=round(val, 2),
                baseline_median_kwh=round(med, 2),
                z_score=round(mod_z, 2),
                severity=severity,
                reason=f"Sudden spike: {val:.1f} kWh is {pct_above}% above the baseline median ({med:.1f} kWh)."
            ))

    return anomalies


def forecast_monthly_bill(property_id: str, meter_id: str) -> ForecastResponse:
    """
    Calculates MTD actual consumption, forecasts the remaining days with uncertainty intervals,
    and identifies which anomalous readings had the strongest influence on the bill.
    """
    today = date.today()
    current_year = today.year
    current_month = today.month
    days_in_month = calendar.monthrange(current_year, current_month)[1]
    days_elapsed = today.day
    days_remaining = max(0, days_in_month - days_elapsed)

    month_str = f"{current_year:04d}-{current_month:02d}"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT reading_date, daily_consumption_kwh 
            FROM readings 
            WHERE meter_id = ? AND reading_date LIKE ?
            ORDER BY reading_date ASC
        """, (meter_id, f"{month_str}%"))
        mtd_records = cursor.fetchall()

    mtd_kwh = sum(r["daily_consumption_kwh"] for r in mtd_records)
    daily_values = [r["daily_consumption_kwh"] for r in mtd_records if r["daily_consumption_kwh"] > 0]

    # If no data this month, look at overall historical average
    if len(daily_values) < 3:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT daily_consumption_kwh 
                FROM readings 
                WHERE meter_id = ? AND daily_consumption_kwh > 0
                ORDER BY reading_date DESC LIMIT 30
            """, (meter_id,))
            hist_records = cursor.fetchall()
            daily_values = [r["daily_consumption_kwh"] for r in hist_records]

    avg_daily = statistics.mean(daily_values) if daily_values else 10.0
    stdev_daily = statistics.stdev(daily_values) if len(daily_values) > 1 else (avg_daily * 0.25)

    # Uncertainty scaling over remaining days
    uncertainty_margin = (1.96 * stdev_daily * math.sqrt(days_remaining)) if days_remaining > 0 else 0.0

    expected_remaining = days_remaining * avg_daily
    proj_expected_kwh = round(mtd_kwh + expected_remaining, 2)
    proj_optimistic_kwh = round(max(mtd_kwh, proj_expected_kwh - uncertainty_margin), 2)
    proj_pessimistic_kwh = round(proj_expected_kwh + uncertainty_margin, 2)

    # Calculate bills for all 3 scenarios
    bill_expected = calculate_bill_for_property(property_id, proj_expected_kwh)
    bill_optimistic = calculate_bill_for_property(property_id, proj_optimistic_kwh)
    bill_pessimistic = calculate_bill_for_property(property_id, proj_pessimistic_kwh)

    # Detect anomalies
    anomalies = detect_anomalies(meter_id)

    # Find influential spikes that drove the forecast higher
    influential_spikes = []
    for a in anomalies:
        if a.reading_date.startswith(month_str):
            excess_kwh = a.consumption_kwh - a.baseline_median_kwh
            impact_inr = round(excess_kwh * 7.5, 2)  # Approximating upper slab rate
            influential_spikes.append({
                "date": a.reading_date,
                "spike_kwh": a.consumption_kwh,
                "baseline_kwh": a.baseline_median_kwh,
                "estimated_bill_impact": f"+₹{impact_inr}"
            })

    return ForecastResponse(
        current_month=today.strftime("%B %Y"),
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        mtd_actual_kwh=round(mtd_kwh, 2),
        projected_total_kwh_expected=proj_expected_kwh,
        projected_total_kwh_optimistic=proj_optimistic_kwh,
        projected_total_kwh_pessimistic=proj_pessimistic_kwh,
        projected_bill_expected_inr=bill_expected.total_estimated_bill,
        projected_bill_optimistic_inr=bill_optimistic.total_estimated_bill,
        projected_bill_pessimistic_inr=bill_pessimistic.total_estimated_bill,
        anomalies=anomalies,
        influential_spikes=influential_spikes
    )
