@echo off
echo ==============================================================
echo        PowerSaver Platform - Team 7 Quick Launcher
echo ==============================================================
echo.

IF NOT EXIST "backend\venv\Scripts\python.exe" (
    echo [INFO] Setting up Python virtual environment...
    py -m venv backend\venv
    call backend\venv\Scripts\pip install -r backend\requirements.txt
    backend\venv\Scripts\python.exe -m backend.src.seed_data
)

echo [INFO] Starting PowerSaver Server at http://127.0.0.1:8000 ...
echo [INFO] Swagger Docs available at http://127.0.0.1:8000/docs
echo.

start http://127.0.0.1:8000

backend\venv\Scripts\uvicorn.exe backend.src.main:app --host 127.0.0.1 --port 8000 --reload
pause
