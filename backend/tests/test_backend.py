import unittest
import os
from fastapi import HTTPException

from backend.src.database import init_db, get_db
from backend.src.models import PropertyCreate, ReadingCreate, ApplianceCreate
from backend.src.services.tariff_engine import calculate_slab_bill, calculate_bill_for_property
from backend.src.services.reading_service import record_reading, list_readings, compare_historical_usage
from backend.src.services.appliance_service import add_appliance, get_appliances_summary, reconcile_meter_with_appliances
from backend.src.services.anomaly_service import detect_anomalies, forecast_monthly_bill
from backend.src.routers.properties import create_property


class TestPowerSaverBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_tariff_calculation_exact(self):
        """Test Indian telescopic tariff billing with fixed charges & duty."""
        # 280 units test
        # Slab 1: 100 * 3.5 = 350
        # Slab 2: 100 * 5.5 = 550
        # Slab 3: 80 * 7.5 = 600
        # Total energy = 1500
        # Fixed charge: 3 kW * 110 = 330
        # Subtotal = 1830
        # Duty: 9% of 1830 = 164.7
        # Total = 1994.7
        bill = calculate_bill_for_property("prop_default", 280.0)
        self.assertEqual(bill.total_units_kwh, 280.0)
        self.assertEqual(bill.energy_charges, 1500.0)
        self.assertEqual(bill.fixed_charges, 330.0)
        self.assertEqual(bill.electricity_duty_tax, 164.7)
        self.assertEqual(bill.total_estimated_bill, 1994.7)

    def test_02_property_creation(self):
        """Test creating a new property automatically creates a grid meter."""
        prop = create_property(PropertyCreate(name="Hostel Block A", property_type="hostel", sanctioned_load_kw=5.0))
        self.assertTrue(prop.id.startswith("prop_"))
        self.assertEqual(prop.name, "Hostel Block A")
        self.assertEqual(prop.sanctioned_load_kw, 5.0)

    def test_03_meter_reading_delta_calculation(self):
        """Test that recording a reading computes daily delta consumption correctly."""
        meter_id = "meter_test_delta"
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO meters (id, property_id, meter_number, meter_type) VALUES (?, 'prop_default', 'MTR-DELTA', 'grid')", (meter_id,))

        # Day 1: 500.0 kWh
        r1 = record_reading(ReadingCreate(meter_id=meter_id, reading_date="2026-10-01", cumulative_kwh=500.0))
        self.assertEqual(r1.daily_consumption_kwh, 0.0)

        # Day 2: 512.5 kWh (delta = 12.5 kWh over 1 day)
        r2 = record_reading(ReadingCreate(meter_id=meter_id, reading_date="2026-10-02", cumulative_kwh=512.5))
        self.assertEqual(r2.daily_consumption_kwh, 12.5)
        self.assertEqual(r2.days_elapsed, 1)

    def test_04_reading_rollback_rejection(self):
        """Test that meter readings cannot go backwards in time."""
        meter_id = "meter_test_delta"
        with self.assertRaises(HTTPException) as ctx:
            # Trying to record 510.0 on Oct 3 when Oct 2 was 512.5
            record_reading(ReadingCreate(meter_id=meter_id, reading_date="2026-10-03", cumulative_kwh=510.0))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("lower than previous reading", ctx.exception.detail)

    def test_05_missing_reading_gap_alert(self):
        """Test that a gap > 3 days between readings raises an alert."""
        meter_id = "meter_test_delta"
        # Reading recorded on Oct 10 (gap of 8 days from Oct 2)
        r_gap = record_reading(ReadingCreate(meter_id=meter_id, reading_date="2026-10-10", cumulative_kwh=592.5))
        self.assertEqual(r_gap.days_elapsed, 8)
        self.assertEqual(r_gap.daily_consumption_kwh, 10.0)  # (592.5 - 512.5) / 8 = 10.0

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alerts WHERE meter_id = ? AND alert_type = 'missing_reading'", (meter_id,))
            alert = cursor.fetchone()
            self.assertIsNotNone(alert)
            self.assertIn("gap of 8 days", alert["message"])

    def test_06_appliance_inventory_math(self):
        """Test bottom-up appliance consumption math."""
        app = add_appliance(ApplianceCreate(
            property_id="prop_default",
            name="1000W Microwave",
            rated_wattage=1000,
            daily_hours_used=0.5,
            quantity=1,
            category="kitchen"
        ))
        self.assertEqual(app.estimated_daily_kwh, 0.5)  # (1000 * 0.5) / 1000 = 0.5 kWh
        self.assertEqual(app.estimated_monthly_kwh, 15.0) # 0.5 * 30 = 15.0 kWh

    def test_07_historical_comparison(self):
        """Test month-over-month and week-over-week comparison logic."""
        res = compare_historical_usage("meter_main")
        self.assertIn("month_over_month", res)
        self.assertIn("week_over_week", res)
        self.assertIn("trend", res["week_over_week"])

    def test_08_reconciliation_report(self):
        """Test safety & ethics reconciliation report distinguishing measured from estimated."""
        recon = reconcile_meter_with_appliances("prop_default", "meter_main")
        self.assertIn("measured_meter_kwh", recon)
        self.assertIn("estimated_appliances_kwh", recon)
        self.assertIn("data_provenance", recon)
        self.assertIn("Verified Ground Truth", recon["data_provenance"]["meter_data_status"])
        self.assertIn("Bottom-Up Mathematical Approximation", recon["data_provenance"]["appliance_data_status"])

    def test_09_anomaly_detection(self):
        """Test Modified Z-Score anomaly detection identifies spikes."""
        anomalies = detect_anomalies("meter_main", threshold_z=2.0)
        self.assertIsInstance(anomalies, list)
        self.assertGreater(len(anomalies), 0)
        self.assertIn(anomalies[0].severity, ["MEDIUM", "HIGH"])

    def test_10_forecasting_with_uncertainty_bounds(self):
        """Test that forecasting produces ordered confidence bounds (Optimistic <= Expected <= Pessimistic)."""
        f = forecast_monthly_bill("prop_default", "meter_main")
        self.assertLessEqual(f.projected_total_kwh_optimistic, f.projected_total_kwh_expected)
        self.assertLessEqual(f.projected_total_kwh_expected, f.projected_total_kwh_pessimistic)
        self.assertLessEqual(f.projected_bill_optimistic_inr, f.projected_bill_expected_inr)
        self.assertLessEqual(f.projected_bill_expected_inr, f.projected_bill_pessimistic_inr)


if __name__ == "__main__":
    unittest.main()
