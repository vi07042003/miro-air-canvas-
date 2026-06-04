@echo off
title AeroCanvas Launcher
echo ===================================================
echo               AeroCanvas Launcher                  
echo ===================================================
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.8+ and try again.
    pause
    exit /b 1
)

:: Check for Node / NPM
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js/NPM is not installed or not in your PATH.
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

:: Start FastAPI Backend in a new window
echo [INFO] Starting FastAPI Backend on port 8000...
start "AeroCanvas Backend API" cmd /k "cd backend && echo Installing backend python dependencies... && pip install -r requirements.txt && echo Starting FastAPI server... && uvicorn main:app --reload --port 8000"

:: Start Vite Frontend in the current window
echo [INFO] Launching React Frontend...
cd frontend
npm run dev
