from typing import List, Dict, Any, Optional
from ..database import get_db
from ..models import BillCalculationResponse, SlabBreakdown


def calculate_slab_bill(
    total_units: float,
    sanctioned_load_kw: float,
    fixed_charge_per_kw: float,
    tax_percentage: float,
    slabs: List[Dict[str, Any]]
) -> BillCalculationResponse:
    """
    Computes an Indian Telescopic Slab bill with fixed charges and electricity duty.
    """
    if total_units < 0:
        total_units = 0.0

    energy_charges = 0.0
    slab_breakdowns: List[SlabBreakdown] = []

    # Sort slabs by min_units ascending
    sorted_slabs = sorted(slabs, key=lambda s: s["min_units"])

    for slab in sorted_slabs:
        min_u = float(slab["min_units"])
        max_u = float(slab["max_units"]) if slab.get("max_units") is not None else None
        rate = float(slab["rate_per_unit"])

        if total_units <= min_u:
            continue

        # Calculate units falling inside this slab
        if max_u is not None:
            slab_capacity = max_u - (min_u if min_u == 0 else min_u - 1)
            units_in_slab = min(total_units - (min_u if min_u == 0 else min_u - 1), slab_capacity)
        else:
            # Open-ended top slab (e.g. 401+)
            base_threshold = min_u if min_u == 0 else min_u - 1
            units_in_slab = max(0.0, total_units - base_threshold)

        if units_in_slab > 0:
            cost = units_in_slab * rate
            energy_charges += cost
            label = f"{int(min_u)}-{int(max_u)}" if max_u is not None else f"{int(min_u)}+"
            slab_breakdowns.append(SlabBreakdown(
                slab_label=label,
                units_in_slab=round(units_in_slab, 2),
                rate_per_unit=rate,
                amount=round(cost, 2)
            ))

    fixed_charges = round(sanctioned_load_kw * fixed_charge_per_kw, 2)
    subtotal = round(energy_charges + fixed_charges, 2)
    electricity_duty = round(subtotal * (tax_percentage / 100.0), 2)
    total_bill = round(subtotal + electricity_duty, 2)

    return BillCalculationResponse(
        total_units_kwh=round(total_units, 2),
        energy_charges=round(energy_charges, 2),
        fixed_charges=fixed_charges,
        subtotal=subtotal,
        electricity_duty_tax=electricity_duty,
        total_estimated_bill=total_bill,
        slab_breakdown=slab_breakdowns
    )


def calculate_bill_for_property(property_id: str, total_units: float) -> BillCalculationResponse:
    """
    Fetches the configured tariff plan for a property and calculates the bill.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        # Get property load
        cursor.execute("SELECT sanctioned_load_kw FROM properties WHERE id = ?", (property_id,))
        prop_row = cursor.fetchone()
        sanctioned_load = prop_row["sanctioned_load_kw"] if prop_row else 3.0

        # Get tariff plan
        cursor.execute("SELECT id, fixed_charge_per_kw, tax_percentage FROM tariff_plans WHERE property_id = ?", (property_id,))
        plan_row = cursor.fetchone()

        if not plan_row:
            # Fallback to default
            cursor.execute("SELECT id, fixed_charge_per_kw, tax_percentage FROM tariff_plans WHERE id = 'tariff_default'")
            plan_row = cursor.fetchone()

        plan_id = plan_row["id"]
        fixed_charge = plan_row["fixed_charge_per_kw"]
        tax_pct = plan_row["tax_percentage"]

        cursor.execute("SELECT min_units, max_units, rate_per_unit FROM tariff_slabs WHERE plan_id = ? ORDER BY min_units", (plan_id,))
        slabs = [dict(row) for row in cursor.fetchall()]

    return calculate_slab_bill(
        total_units=total_units,
        sanctioned_load_kw=sanctioned_load,
        fixed_charge_per_kw=fixed_charge,
        tax_percentage=tax_pct,
        slabs=slabs
    )
