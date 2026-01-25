@echo off
REM ============================================
REM SmartWish Print Agent - Kiosk Setup Script
REM ============================================
REM Run this script ONCE on a new kiosk machine
REM to install all required dependencies.
REM ============================================

cd /d "%~dp0"
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   SmartWish Print Agent - Kiosk Setup
echo ============================================
echo.

set ERRORS=0

REM ============================================
REM 1. Check Node.js
REM ============================================
echo [1/5] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ Node.js is NOT installed!
    echo   Please install Node.js 18+ from: https://nodejs.org/
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   ✅ Node.js installed: !NODE_VERSION!
)

REM ============================================
REM 2. Check Python
REM ============================================
echo.
echo [2/5] Checking Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ Python is NOT installed!
    echo   Please install Python 3.8+ from: https://python.org/
    echo   Make sure to check "Add Python to PATH" during installation!
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    echo   ✅ Python installed: !PYTHON_VERSION!
)

REM ============================================
REM 3. Install Node.js dependencies
REM ============================================
echo.
echo [3/5] Installing Node.js dependencies...
if exist "node_modules" (
    echo   ℹ️  node_modules exists, running npm install anyway...
)
call npm install
if %errorlevel% neq 0 (
    echo   ❌ npm install failed!
    set /a ERRORS+=1
) else (
    echo   ✅ Node.js dependencies installed
)

REM ============================================
REM 4. Install Python dependencies (for surveillance)
REM ============================================
echo.
echo [4/5] Installing Python dependencies for surveillance...
if exist "surveillance\requirements.txt" (
    python -m pip install -r surveillance\requirements.txt --quiet
    if %errorlevel% neq 0 (
        echo   ⚠️  Python dependencies failed to install
        echo   Surveillance features may not work.
        echo   Try running: pip install -r surveillance\requirements.txt
    ) else (
        echo   ✅ Python dependencies installed
    )
) else (
    echo   ⚠️  surveillance\requirements.txt not found
)

REM ============================================
REM 5. Check YOLO model files
REM ============================================
echo.
echo [5/5] Checking YOLO model files...
set YOLO_FOUND=0

if exist "surveillance\yolo26n.pt" (
    echo   ✅ Found: surveillance\yolo26n.pt
    set YOLO_FOUND=1
)
if exist "surveillance\yolo11n.pt" (
    echo   ✅ Found: surveillance\yolo11n.pt
    set YOLO_FOUND=1
)
if exist "surveillance\yolov8n.pt" (
    echo   ✅ Found: surveillance\yolov8n.pt
    set YOLO_FOUND=1
)
if exist "yolo11n-cls.pt" (
    echo   ✅ Found: yolo11n-cls.pt
    set YOLO_FOUND=1
)

if !YOLO_FOUND!==0 (
    echo   ⚠️  No YOLO model found!
    echo   The model will be auto-downloaded on first surveillance run.
    echo   Or manually download yolov8n.pt from ultralytics and place in surveillance folder.
)

REM ============================================
REM Check config file
REM ============================================
echo.
echo Checking configuration...
if not exist "config.json" (
    if exist "config.example.json" (
        echo   ℹ️  Creating config.json from config.example.json...
        copy "config.example.json" "config.json" >nul
        echo   ✅ config.json created - please edit with your settings
    ) else (
        echo   ⚠️  No config.json found! Create one before starting.
    )
) else (
    echo   ✅ config.json exists
)

REM ============================================
REM Summary
REM ============================================
echo.
echo ============================================
if !ERRORS! gtr 0 (
    echo   ❌ Setup completed with !ERRORS! error^(s^)
    echo   Please fix the errors above before running.
) else (
    echo   ✅ Setup completed successfully!
    echo.
    echo   Next steps:
    echo   1. Edit config.json with production URLs ^(if needed^)
    echo   2. Run: start-print-agent.bat
    echo   3. Follow on-screen instructions to pair the device
)
echo ============================================
echo.

pause
