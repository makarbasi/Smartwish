@echo off
REM Start the print agent in DEVELOPMENT mode (localhost:3001 - Backend)
REM Double-click this file to test with your local backend

echo.
echo ========================================
echo   STARTING IN DEVELOPMENT MODE
echo   Server: http://localhost:3001 (Backend)
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0start-print-agent.ps1" -Dev

pause

