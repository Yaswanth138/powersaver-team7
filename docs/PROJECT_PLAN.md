# PowerSaver: 7-Day Master Execution Plan & Team Work Breakdown

> **Team 7 | Real-World Problem Solving Challenge**  
> *Help homes and small organizations understand and reduce electricity use.*

---

## 1. Team Roles & Boundary Matrix

To prevent merge conflicts and ensure everyone moves fast without waiting for others, the project is strictly split across three distinct domains:

| Role | Teammate | Focus Area | Isolated Code Area |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Frontend & UI/UX Lead** | Responsive UI, forms, dashboard layouts, modal dialogs, appliance manager | `frontend/src/pages/`, `frontend/src/components/forms/`, `frontend/src/components/ui/` |
| **Member 2** | **Backend & Core Engine Lead** | Relational Database, REST API endpoints, Indian slab tariff engine, bill calculator | `backend/src/models/`, `backend/src/routes/`, `backend/src/services/tariff/` |
| **Member 3** | **Analytics & Visuals Lead** | Recharts visualization, time-series anomaly detection, monthly bill forecasting, validation suite | `backend/src/services/analytics/`, `frontend/src/components/charts/`, `data/samples/` |

---

## 2. API Contract (Agreed Interface so Frontend & Backend Work in Parallel)

Member 1 and Member 2 do **not** need to wait for each other. Member 1 can mock these exact JSON responses in the frontend while Member 2 builds the backend.

### A. Meter Reading Entry
* **Endpoint:** `POST /api/readings`
* **Request Body:**
```json
{
  "property_id": "prop_101",
  "meter_id": "meter_01",
  "reading_date": "2026-11-16",
  "cumulative_kwh": 1420.5
}
```
* **Response (201 Created):**
```json
{
  "id": "read_501",
  "meter_id": "meter_01",
  "reading_date": "2026-11-16",
  "cumulative_kwh": 1420.5,
  "delta_kwh": 12.3,
  "days_elapsed": 1
}
```

### B. Bill Estimation & Slab Calculation
* **Endpoint:** `POST /api/tariffs/calculate`
* **Request Body:**
```json
{
  "property_id": "prop_101",
  "total_units_kwh": 280.0,
  "sanctioned_load_kw": 3.0,
  "fixed_charge_per_kw": 110.0,
  "tax_rate": 0.09,
  "slabs": [
    { "min_units": 0, "max_units": 100, "rate": 3.50 },
    { "min_units": 101, "max_units": 200, "rate": 5.50 },
    { "min_units": 201, "max_units": 400, "rate": 7.50 },
    { "min_units": 401, "max_units": null, "rate": 9.00 }
  ]
}
```
* **Response:**
```json
{
  "energy_charge": 1500.0,
  "fixed_charge": 330.0,
  "subtotal": 1830.0,
  "electricity_duty_tax": 164.7,
  "total_estimated_bill": 1994.7,
  "currency": "INR",
  "slab_breakdown": [
    { "slab": "0-100", "units": 100, "rate": 3.50, "charge": 350.0 },
    { "slab": "101-200", "units": 100, "rate": 5.50, "charge": 550.0 },
    { "slab": "201-400", "units": 80, "rate": 7.50, "charge": 600.0 }
  ]
}
```

### C. Analytics, Anomalies & Forecast
* **Endpoint:** `GET /api/analytics/forecast?property_id=prop_101`
* **Response:**
```json
{
  "month": "November 2026",
  "mtd_actual_kwh": 180.5,
  "forecast_kwh": {
    "optimistic": 320.0,
    "expected": 365.0,
    "pessimistic": 415.0
  },
  "projected_bill_inr": {
    "low": 2450.0,
    "expected": 2890.0,
    "high": 3410.0
  },
  "anomalies": [
    {
      "date": "2026-11-12",
      "consumption_kwh": 24.8,
      "expected_baseline_kwh": 11.5,
      "severity": "HIGH",
      "reason": "Sudden 115% surge compared to 14-day median"
    }
  ],
  "influential_readings": [
    { "date": "2026-11-12", "impact_on_projected_bill": "+₹145" }
  ]
}
```

---

## 3. 7-Day Day-by-Day Sprint Schedule

### Day 1: Architecture, Setup & Wireframes
* **Member 1 (Frontend):** Scaffold React/Next.js app, configure Tailwind CSS & shadcn/ui. Create shared layout (Navbar, Sidebar, Page Shell).
* **Member 2 (Backend):** Set up backend framework (FastAPI or Express), configure SQLite database, write models for `Property`, `Meter`, `Reading`, `Tariff`.
* **Member 3 (Analytics):** Research & draft the anomaly detection formula (Rolling MAD / Z-score) and generate mock CSV dataset with 60 days of realistic readings.
* **Checkpoint 1:** GitHub repo connected; everyone clones and runs `git pull` successfully.

### Day 2: Core Data Ingestion & Delta Calculation
* **Member 1 (Frontend):** Build the **Manual Reading Entry Form** (Date picker, Meter selector, Cumulative kWh input with validation).
* **Member 2 (Backend):** Implement `POST /api/readings` and `GET /api/readings` with automatic calculation of $\Delta kWh = Reading_t - Reading_{t-1}$.
* **Member 3 (Analytics):** Build the Recharts **Daily Consumption Bar Chart** component in `frontend/src/components/charts/DailyBarChart.tsx`.
* **Checkpoint 2:** Member 1 submits a reading form $\to$ Member 2 stores it $\to$ Member 3's chart displays the bar!

### Day 3: Slab Tariff Engine & Appliance Inventory
* **Member 1 (Frontend):** Build the **Appliance Inventory Page** (Add appliance: AC, Geyser, Fridge, Fans; input wattage & daily hours).
* **Member 2 (Backend):** Implement the **Indian Telescopic Slab Calculator** (`POST /api/tariffs/calculate`) including fixed charges and taxes.
* **Member 3 (Analytics):** Build the **Appliance Breakdown Donut Chart** and compute bottom-up estimated kWh vs actual metered kWh.
* **Checkpoint 3:** Entering 280 units correctly calculates the graduated slab bill and shows how much each slab contributed.

### Day 4: Full Dashboard Integration & Alerts Engine
* **Member 1 (Frontend):** Assemble the Main Overview Dashboard (Summary KPI cards: Current Month Units, Estimated Bill, Active Alerts, Quick Entry button).
* **Member 2 (Backend):** Implement **Alerts Logic** (Missing reading after 3 days; meter reading less than previous reading rejected).
* **Member 3 (Analytics):** Implement weekly and monthly trend comparison charts (compare current week against previous 3 weeks).
* **Checkpoint 4:** Complete end-to-end user flow: setup property $\to$ log readings $\to$ see bill and trend charts.

### Day 5: Advanced Challenge — Time-Series Anomaly Detection
* **Member 1 (Frontend):** Build the **Alerts & Anomaly Drawer/Card** with severity tags (High, Medium, Info) and "Mark as Resolved" action.
* **Member 2 (Backend):** Add Property and Meter configuration UI support (multi-meter support: Main grid meter + Submeter).
* **Member 3 (Analytics):** Implement the Anomaly Detection Algorithm (`services/analytics/anomaly.py`):
  * Rolling 14-day median & MAD.
  * Z-score thresholding ($|Z| > 2.5$).
  * Flagging exact dates and highlight them on the main chart with red markers.
* **Checkpoint 5:** Injecting an artificial 30 kWh spike on a 10 kWh baseline triggers a spike alert with reason.

### Day 6: Advanced Challenge — Bill Forecasting & Explainability
* **Member 1 (Frontend):** Build the **Bill Forecast Component** displaying:
  * 3 Range Cards: Best Case (Optimistic), Expected, Worst Case (Pessimistic).
  * "What drove this forecast?" explanation list.
* **Member 2 (Backend):** Implement Evidence-Based Recommendations logic (e.g. *"Shifting 2 hours of AC usage from peak afternoon to fan saves ₹380/mo"*).
* **Member 3 (Analytics):** Implement Monthly Forecasting Algorithm:
  * Month-to-date actual + Day-of-week weighted run rate for remaining days.
  * Prediction intervals ($95\%$ confidence bounds).
  * Impact analysis: list top 3 reading dates that inflated the bill.
* **Checkpoint 6:** Advanced Challenge fully functioning and visible on the dashboard.

### Day 7: Validation, Edge Cases & Demo Polish
* **Member 1 (Frontend):** Responsive mobile testing, dark/light theme, polish loading states and toasts.
* **Member 2 (Backend):** Error handling (meter reset, edge cases, negative deltas), seed script for instant demo setup.
* **Member 3 (Analytics):** Run validation suite comparing estimated bill against a real electricity bill; output estimation error percentage table.
* **Final Checkpoint:** 10-minute dry run of presentation / live demo.

---

## 4. Git Collaboration Rules for the Team (Avoid Merge Conflicts)

### The 5 Golden Rules:
1. **Never push directly to `main`:**
   * `main` is only for stable, verified code.
2. **Every member works on their own branch:**
   * Member 1: `git checkout -b feat/frontend-ui`
   * Member 2: `git checkout -b feat/backend-api`
   * Member 3: `git checkout -b feat/analytics-engine`
3. **Morning Routine (Pull Before You Code):**
   ```bash
   git checkout main
   git pull origin main
   git checkout feat/your-branch
   git merge main
   ```
4. **Small, Frequent Commits:**
   * Do not commit 50 files at once. Commit logical units (e.g., `git commit -m "feat(ui): add meter reading input modal"`).
5. **If You Get a Merge Conflict:**
   * Open the conflicted file in VS Code.
   * VS Code will show `<<<<<<< Current Change` vs `======= Incoming Change`.
   * Click **"Accept Both Changes"** or choose the correct one, save, then:
     ```bash
     git add .
     git commit -m "fix: resolve merge conflict"
     ```
