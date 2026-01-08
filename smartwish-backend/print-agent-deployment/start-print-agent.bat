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
set CLOUD_SERVER_URL=http://localhost:3001
REM set CLOUD_SERVER_URL=https://smartwish.onrender.com

REM Printer name comes from kiosk config (/admin/kiosks) via the print job
REM Only set this if you want a fallback when job doesn't specify printer
REM set DEFAULT_PRINTER=HPIE4B65B (HP OfficeJet Pro 9130e Series)

REM Explicitly clear any previously set DEFAULT_PRINTER
set DEFAULT_PRINTER=

REM How often to check for new jobs (5000 = 5 seconds)
set POLL_INTERVAL=5000

echo Configuration:
echo   Server: %CLOUD_SERVER_URL%
echo   Poll Interval: %POLL_INTERVAL%ms
echo   Printer: Will use printer from each job's kiosk config
echo.

node backend/local-print-agent.js

pause

