@echo off
echo ===============================================
echo   SMARTWISH LOCAL PRINT AGENT
echo ===============================================
echo.
echo This agent polls the cloud server for print jobs
echo and prints them to your local printer.
echo.
echo IMPORTANT: Printer name is now set per-kiosk in
echo /admin/kiosks - no need to change DEFAULT_PRINTER here.
echo The printer from kiosk config is used for each job.
echo.

REM Set your cloud server URL (change if different)
set CLOUD_SERVER_URL=https://smartwish.onrender.com

REM Fallback default printer (only used if job has no printerName)
REM Each job now gets printerName from its kiosk config in /admin/kiosks
set DEFAULT_PRINTER=HP OfficeJet Pro 9130e Series [HPIE4B65B]

REM How often to check for new jobs (5000 = 5 seconds)
set POLL_INTERVAL=5000

echo Configuration:
echo   Server: %CLOUD_SERVER_URL%
echo   Fallback Printer: %DEFAULT_PRINTER%
echo   Poll Interval: %POLL_INTERVAL%ms
echo   Note: Printer name from /admin/kiosks config is used per-job
echo.

REM ===============================================
REM  OPEN BROWSER IN FULLSCREEN MODE
REM ===============================================
echo Opening manager login page in fullscreen...

REM Open browser and send F11 to make it fullscreen
REM This works even if Chrome is already running
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window "https://app.smartwish.us/managers/login"

REM Wait for browser to open
timeout /t 3 /nobreak >nul

REM Send F11 to Chrome to toggle fullscreen
powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('Chrome'); Start-Sleep -Milliseconds 500; $wshell.SendKeys('{F11}')"

REM Wait a moment before continuing
timeout /t 1 /nobreak >nul

REM Start the print agent
node backend/local-print-agent.js

pause

