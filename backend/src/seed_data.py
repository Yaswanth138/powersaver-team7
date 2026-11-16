from datetime import date, timedelta
from .database import init_db, get_db
from .services.reading_service import record_reading
from .models import ReadingCreate, ApplianceCreate
from .services.appliance_service import add_appliance
from .services.tariff_engine import calculate_bill_for_property


def seed_demo_data():
    init_db()

    property_id = "prop_default"
    meter_id = "meter_main"

    print("--- Seeding Appliances ---")
    appliances = [
        ApplianceCreate(property_id=property_id, name="1.5 Ton 5-Star Split AC", rated_wattage=1450, daily_hours_used=6.0, quantity=1, category="cooling"),
        ApplianceCreate(property_id=property_id, name="Double Door Refrigerator", rated_wattage=250, daily_hours_used=24.0, quantity=1, category="refrigeration"),
        ApplianceCreate(property_id=property_id, name="Storage Water Geyser (25L)", rated_wattage=2000, daily_hours_used=1.5, quantity=1, category="heating"),
        ApplianceCreate(property_id=property_id, name="Ceiling BLDC Fans", rated_wattage=35, daily_hours_used=12.0, quantity=4, category="ventilation"),
        ApplianceCreate(property_id=property_id, name="LED Lighting", rated_wattage=12, daily_hours_used=6.0, quantity=8, category="lighting")
    ]

    for app in appliances:
        add_appliance(app)
        print(f"Added {app.name}")

    print("\n--- Seeding 45 Days of Meter Readings with Anomaly Spikes ---")
    start_date = date.today() - timedelta(days=45)
    current_cum_kwh = 1200.0

    # Day 0 baseline
    record_reading(ReadingCreate(
        meter_id=meter_id,
        reading_date=start_date.strftime("%Y-%m-%d"),
        cumulative_kwh=current_cum_kwh,
        notes="Initial meter baseline reading"
    ))

    # Daily increment generator
    # Regular daily: ~10.5 kWh
    # Day 30-32: Heatwave surge ~25 kWh/day (Anomaly spike)
    for day_offset in range(1, 46):
        d = start_date + timedelta(days=day_offset)
        if 30 <= day_offset <= 32:
            daily_use = 25.5  # Heavy spike
            note = "High AC usage during weekend heatwave"
        elif day_offset == 15:
            daily_use = 3.2   # Low usage / family away
            note = "House locked for weekend trip"
        else:
            daily_use = 10.2 + (day_offset % 3) * 0.8  # Normal range: 10.2 - 11.8 kWh

        current_cum_kwh += daily_use
        record_reading(ReadingCreate(
            meter_id=meter_id,
            reading_date=d.strftime("%Y-%m-%d"),
            cumulative_kwh=round(current_cum_kwh, 2),
            notes=note if 'note' in locals() else None
        ))

    print(f"Successfully seeded 45 readings. Final meter reading: {current_cum_kwh:.2f} kWh")

    # Run quick bill calculation check
    bill = calculate_bill_for_property(property_id, 280.0)
    print("\n--- Benchmark Validation (280 units) ---")
    print(f"Energy Charges: ₹{bill.energy_charges}")
    print(f"Fixed Charges: ₹{bill.fixed_charges}")
    print(f"Duty (9%): ₹{bill.electricity_duty_tax}")
    print(f"Total Bill: ₹{bill.total_estimated_bill}")


if __name__ == "__main__":
    seed_demo_data()
