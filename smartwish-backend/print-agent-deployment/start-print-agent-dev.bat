@echo off
REM Start the print agent in DEVELOPMENT mode (localhost:3001 - Backend)
REM Double-click this file to test with your local backend
REM
REM Options:
REM   -NoBrowser : Skip opening browser in fullscreen

echo.
echo ========================================
echo   STARTING IN DEVELOPMENT MODE
echo   Server: http://localhost:3001 (Backend)
echo   Browser: Opens /managers/login in fullscreen
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0start-print-agent.ps1" -Dev

pause

