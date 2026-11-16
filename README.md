# PowerSaver (Team 7) ⚡
> **Real-World Problem Solving Challenge**  
> *Help homes and small organizations understand and reduce electricity use.*

---

## 📌 Project Overview
PowerSaver is an energy monitoring and analysis platform that empowers households, hostel/facility managers, and small businesses to:
1. Record manual electricity meter readings (date and meter ID).
2. Maintain an appliance inventory with estimated wattage and hours of use.
3. Track daily, weekly, and monthly consumption trends with interactive charts.
4. Estimate electricity bills using user-configured DISCOM slab tariff rules and fixed charges.
5. Receive automatic alerts for unusual consumption spikes or missing readings.
6. **Advanced Challenge:** Apply time-series anomaly detection and statistical monthly forecasting with uncertainty intervals.

---

## 👥 Team 7 Roster & Responsibilities

| Role | Member | Primary Focus Area | Directory Ownership |
| :--- | :--- | :--- | :--- |
| **Frontend & UI/UX Lead** | Member 1 | UI Layout, Forms, Appliance Inventory, Settings | `frontend/` |
| **Backend & Tariff Engine Lead** | Member 2 | Database, REST APIs, Slab Calculation, Bill Engine | `backend/` |
| **Analytics & Visualization Lead** | Member 3 | Recharts, Anomaly Detection, Forecasting, Validation | `backend/services/analytics/`, `frontend/src/components/charts/` |

---

## 🛠️ Architecture & Folder Structure

```text
nxtwave_project-1/
├── frontend/             # Next.js / React UI application
│   ├── src/
│   │   ├── components/   # UI components, forms, layout
│   │   │   └── charts/   # Data visualization (Member 3)
│   │   ├── pages/        # Views & routing
│   │   └── services/     # API client functions
│   └── package.json
│
├── backend/              # REST API & Database engine
│   ├── src/
│   │   ├── models/       # Database entities (SQLAlchemy / Prisma)
│   │   ├── routes/       # API endpoints (meters, readings, tariffs)
│   │   └── services/
│   │       ├── tariff/   # Slab calculation & fixed charges (Member 2)
│   │       └── analytics/# Anomaly detection & Forecasting (Member 3)
│   └── requirements.txt
│
├── data/
│   └── samples/          # Realistic sample readings & validation benchmarks
├── docs/                 # Team docs, API contracts, and milestone plan
├── .gitignore            # Clean git exclusion rules
└── README.md
```

---

## 🚀 Quick Start for Teammates

### 1. Clone & Set Up Your Branch
```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd nxtwave_project-1

# Create your feature branch (NEVER commit directly to main)
# Member 1:
git checkout -b feat/frontend-ui

# Member 2:
git checkout -b feat/backend-api

# Member 3:
git checkout -b feat/analytics-engine
```

### 2. Daily Git Routine (Avoid Merge Conflicts)
```bash
# 1. Before starting work, pull the latest changes from main:
git checkout main
git pull origin main
git checkout your-branch-name
git merge main

# 2. Work on your assigned directory, commit frequently:
git add .
git commit -m "feat(scope): short description of what you did"

# 3. Push your branch to GitHub:
git push origin your-branch-name
```

---

## 📋 Detailed Plan & Schedule
See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for the complete day-by-day task checklist and deliverables.
