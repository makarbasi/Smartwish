@echo off
echo ===============================================
echo   SMARTWISH LOCAL PRINT AGENT
echo ===============================================
echo.
echo This agent polls the cloud server for print jobs
echo and prints them to your local printer.
echo.
echo Make sure you have set the correct printer name!
echo.

REM Set your cloud server URL (change if different)
set CLOUD_SERVER_URL=https://smartwish.onrender.com

REM Set your default printer name (find exact name in Windows printer settings)
set DEFAULT_PRINTER=HPA4CC43 (HP Smart Tank 7600 series)

REM How often to check for new jobs (5000 = 5 seconds)
set POLL_INTERVAL=5000

echo Configuration:
echo   Server: %CLOUD_SERVER_URL%
echo   Printer: %DEFAULT_PRINTER%
echo   Poll Interval: %POLL_INTERVAL%ms
echo.

REM ===============================================
REM  OPEN BROWSER IN FULLSCREEN KIOSK MODE
REM ===============================================
echo Opening manager login page in fullscreen...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --start-fullscreen "%CLOUD_SERVER_URL%/managers/login"

REM Wait a moment for browser to launch
timeout /t 2 /nobreak >nul

REM Start the print agent
node local-print-agent.js

pause
