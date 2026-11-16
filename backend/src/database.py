import sqlite3
import os
from contextlib import contextmanager

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "..", "powersaver.sqlite3")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db():
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()

        # Properties
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS properties (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            property_type TEXT DEFAULT 'residential', -- residential, hostel, commercial
            sanctioned_load_kw REAL DEFAULT 3.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Meters
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS meters (
            id TEXT PRIMARY KEY,
            property_id TEXT NOT NULL,
            meter_number TEXT NOT NULL,
            meter_type TEXT DEFAULT 'grid', -- grid, solar, submeter
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        );
        """)

        # Meter Readings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id TEXT PRIMARY KEY,
            meter_id TEXT NOT NULL,
            reading_date TEXT NOT NULL, -- YYYY-MM-DD
            cumulative_kwh REAL NOT NULL,
            daily_consumption_kwh REAL DEFAULT 0.0,
            days_elapsed INTEGER DEFAULT 1,
            is_estimated INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meter_id) REFERENCES meters (id) ON DELETE CASCADE,
            UNIQUE (meter_id, reading_date)
        );
        """)

        # Appliances Inventory
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS appliances (
            id TEXT PRIMARY KEY,
            property_id TEXT NOT NULL,
            name TEXT NOT NULL,
            rated_wattage REAL NOT NULL,
            daily_hours_used REAL NOT NULL,
            quantity INTEGER DEFAULT 1,
            category TEXT DEFAULT 'general', -- cooling, heating, refrigeration, lighting, electronics
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        );
        """)

        # Tariff Configuration
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tariff_plans (
            id TEXT PRIMARY KEY,
            property_id TEXT NOT NULL UNIQUE,
            discom_name TEXT NOT NULL, -- e.g. BESCOM, TNEB, MSEDCL, BSES
            fixed_charge_per_kw REAL DEFAULT 110.0,
            tax_percentage REAL DEFAULT 9.0, -- e.g. 9% electricity duty
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        );
        """)

        # Tariff Slabs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tariff_slabs (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            min_units REAL NOT NULL,
            max_units REAL, -- NULL for upper open slab (e.g. 400+)
            rate_per_unit REAL NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES tariff_plans (id) ON DELETE CASCADE
        );
        """)

        # Alerts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            property_id TEXT NOT NULL,
            meter_id TEXT,
            alert_type TEXT NOT NULL, -- spike, missing_reading, anomaly, threshold_crossed
            severity TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
            message TEXT NOT NULL,
            reading_date TEXT,
            is_resolved INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        );
        """)

        # Seed a default property, meter & standard Indian telescopic tariff if none exist
        cursor.execute("SELECT COUNT(*) as count FROM properties")
        if cursor.fetchone()["count"] == 0:
            cursor.execute("""
            INSERT INTO properties (id, name, property_type, sanctioned_load_kw)
            VALUES ('prop_default', 'My Home', 'residential', 3.0);
            """)
            cursor.execute("""
            INSERT INTO meters (id, property_id, meter_number, meter_type)
            VALUES ('meter_main', 'prop_default', 'MTR-2026-001', 'grid');
            """)
            cursor.execute("""
            INSERT INTO tariff_plans (id, property_id, discom_name, fixed_charge_per_kw, tax_percentage)
            VALUES ('tariff_default', 'prop_default', 'Standard Telescopic Tariff', 110.0, 9.0);
            """)
            # Standard Indian Telescopic Slabs
            slabs = [
                ('slab_1', 'tariff_default', 0, 100, 3.50),
                ('slab_2', 'tariff_default', 101, 200, 5.50),
                ('slab_3', 'tariff_default', 201, 400, 7.50),
                ('slab_4', 'tariff_default', 401, None, 9.00),
            ]
            cursor.executemany("""
            INSERT INTO tariff_slabs (id, plan_id, min_units, max_units, rate_per_unit)
            VALUES (?, ?, ?, ?, ?);
            """, slabs)
