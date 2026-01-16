@echo off
REM ============================================
REM SmartWish Local Print Agent Launcher
REM ============================================
REM All configuration is in config.json
REM Edit config.json to change settings.
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

REM Start the print agent
echo ============================================
echo   SmartWish Local Print Agent
echo ============================================
echo.
echo   Configuration: config.json
echo.
echo   NOTE: localhost:8765 and localhost:8766 are
echo   LOCAL services on this machine, not cloud connections.
echo.

node local-print-agent.js

REM Keep window open if there was an error
if %errorlevel% neq 0 (
    echo.
    echo Print agent stopped with error code: %errorlevel%
    pause
)
