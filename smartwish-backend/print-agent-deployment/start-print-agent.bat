@echo off
REM ============================================
REM SmartWish Local Print Agent Launcher
REM ============================================
REM This script starts the local print agent.
REM On first run, it will open the browser for device pairing.
REM After pairing, it remembers the kiosk and starts automatically.
REM ============================================

cd /d "%~dp0"

REM Check if Node.js is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Set environment variables (defaults - will be overridden by cloud config after pairing)
set CLOUD_SERVER_URL=https://smartwish.onrender.com
set FRONTEND_URL=https://app.smartwish.us
set POLL_INTERVAL=10000

REM For local development, uncomment the line below:

set FRONTEND_URL=http://localhost:3000

REM Start the print agent
echo ============================================
echo Starting SmartWish Local Print Agent...
echo ============================================
echo.
echo If this is your first time, a browser will open
echo for you to pair this device with a kiosk.
echo.

node local-print-agent.js

REM Keep window open if there was an error
if %errorlevel% neq 0 (
    echo.
    echo Print agent stopped with error code: %errorlevel%
    pause
)
