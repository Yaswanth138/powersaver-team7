from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


@app.get("/")
def root():
    return {
        "project": "PowerSaver (Team 7)",
        "status": "online",
        "documentation": "/docs",
        "endpoints": [
            "/api/properties",
            "/api/readings",
            "/api/tariffs",
            "/api/appliances",
            "/api/analytics"
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
