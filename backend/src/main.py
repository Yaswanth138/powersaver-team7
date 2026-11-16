import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from .database import init_db
from .routers import properties, readings, tariffs, appliances, analytics

# Initialize SQLite tables
init_db()

app = FastAPI(
    title="PowerSaver API",
    description="Real-World Energy Monitoring, Tariff Engine & Time-Series Anomaly Detection Platform",
    version="1.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(properties.router)
app.include_router(readings.router)
app.include_router(tariffs.router)
app.include_router(appliances.router)
app.include_router(analytics.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Mount static frontend application
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

