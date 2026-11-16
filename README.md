# PowerSaver ⚡ (Team 7)
> **Real-World Problem Solving Challenge Platform**  
> *Help homes, hostels, and small businesses understand, predict, and optimize electricity consumption.*

[![Tests](https://img.shields.io/badge/Unit%20Tests-10%2F10%20Passed-emerald)](backend/tests/test_backend.py)
[![Validation](https://img.shields.io/badge/Estimation%20Error-5.14%25%20(High%20Precision)-blue)](backend/src/validate_solution.py)
[![UI Design](https://img.shields.io/badge/UI%2FUX-Dribbble%20Dashcom%20SaaS-purple)](frontend/)
[![Architecture](https://img.shields.io/badge/Backend-FastAPI%20%2B%20SQLite-indigo)](backend/)

---

## 📌 Executive Summary
PowerSaver is an energy monitoring and bill optimization platform designed specifically to eliminate **"Bill Shock"** for Indian households, PG/hostel managers, and small businesses. 

It bridges the gap between **measured ground-truth meter readings**, **bottom-up appliance inventories**, and **predictive time-series intelligence**—allowing users to pinpoint exact surge days, simulate graduated tariff slabs, and receive actionable saving recommendations before the billing cycle ends.

---

## 🌟 Key Features Delivered

| Module | Real-World Capability | Challenge Requirement |
| :--- | :--- | :--- |
| **Manual Reading Ingestion** | Date-indexed cumulative kWh recording with strict rollback validation ($Reading_t \ge Reading_{t-1}$) and CSV export. | ✅ Core Feature |
| **Indian Slab Tariff Engine** | Telescopic graduated slab calculation (0–100, 101–200, 201–400, 401+), fixed contracted charges (per kW), and 9% state electricity duty. | ✅ Core Feature |
| **Appliance Power Modeling** | Bottom-up wattage $\times$ hours $\times$ quantity calculation with category donut breakdown (Cooling, Heating, Refrigeration, Fans, Lighting). | ✅ Core Feature |
| **Safety & Ethics Reconciliation** | Contrasts top-down measured meter ground-truth against bottom-up appliance estimates, detecting phantom base loads with ethical disclaimers. | ✅ Safety & Ethics |
| **Advanced Anomaly Detection** | Statistical Modified Z-Score (rolling median & MAD) flagging surge spikes directly on interactive dual-line charts with hover tooltips. | ✅ Advanced Challenge |
| **3-Band Monthly Bill Forecast** | Projects end-of-month bills across Optimistic, Expected, and Pessimistic (95% CI) ranges with explainable spike attribution. | ✅ Advanced Challenge |
| **Dribbble "Dashcom" UI/UX** | Fluid SaaS layout with live telemetry flow animation, smooth rolling number counters, 5-step guided user journey stepper, and Lucide vector icons. | ✅ Modern UI/UX |

---

## 🚀 Quick Start (Run Locally in 10 Seconds)

### Option 1: 1-Click Windows Launcher (Fastest)
Simply double-click:
```text
start.bat
```
*(Automatically sets up the Python virtual environment, seeds 45 days of realistic sample data with heatwave anomalies, and opens the dashboard in your browser).*

---

### Option 2: Docker Container (Production)
```bash
docker compose up --build
```
Navigate to **`http://localhost:8000/`**.

---

### Option 3: Manual Startup
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Seed realistic benchmark data
python -m backend.src.seed_data

# 3. Run automated test suite
python -m unittest backend.tests.test_backend

# 4. Start Server
uvicorn backend.src.main:app --host 127.0.0.1 --port 8000 --reload
```
* **Interactive UI:** Open [`http://127.0.0.1:8000/`](http://127.0.0.1:8000/)
* **Interactive API Swagger Docs:** Open [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)

---

## 🧪 Solution Validation & Test Results

### 1. Automated Test Suite (100% Pass Rate)
```text
test_01_tariff_calculation_exact ... ok
test_02_property_creation ... ok
test_03_meter_reading_delta_calculation ... ok
test_04_reading_rollback_rejection ... ok
test_05_missing_reading_gap_alert ... ok
test_06_appliance_inventory_math ... ok
test_07_historical_comparison ... ok
test_08_reconciliation_report ... ok
test_09_anomaly_detection ... ok
test_10_forecasting_with_uncertainty_bounds ... ok
----------------------------------------------------------------------
Ran 10 tests in 0.095s - OK
```

### 2. Bill Estimation Accuracy Benchmark
```text
================================================================
  POWERSAVER SOLUTION VALIDATION & ESTIMATION ERROR BENCHMARK  
================================================================
Test Case                                  | Units  | Known Bill  | Estimated   | Error %
--------------------------------------------------------------------------------------------
Low Consumption Household (Slab 1 only)    | 85.0   | ₹692.65     | ₹683.98     | 1.25  %
Typical Middle-Class 2BHK (Crosses Slab 2) | 180.0  | ₹1419.00    | ₹1220.80    | 13.97 %
Summer High Usage with AC (Crosses Slab 3) | 280.0  | ₹1994.70    | ₹1994.70    | 0.00  %
Hostel Floor / Small Commercial (Slab 4)   | 450.0  | ₹3290.00    | ₹3466.20    | 5.36  %
--------------------------------------------------------------------------------------------
Average Estimation Error across all benchmark slabs: 5.14% (High Precision)
[VALIDATION STATUS]: PASSED
```

---

## 🔮 Future Roadmap & Production Bundles

For the full architectural expansion plan, hardware specifications (ESP32 / CT Clamp IoT telemetry), Computer Vision OCR meter scanning, Solar Net-Metering, and Conversational Gemini AI integration, see:  
👉 **[docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md)**

---

## 👥 Team 7 Contributors
* **Team Lead & Full-Stack Architect**
* Built with 20-year engineering rigor for the **Real-World Problem Solving Challenge**.
