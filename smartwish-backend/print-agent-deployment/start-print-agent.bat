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

REM Printing defaults (can be overridden per job)
REM Duplex: simplex | duplex | duplexshort | duplexlong
set DEFAULT_DUPLEX_SIDE=duplexshort
REM Borderless: true/false. True tries to select a borderless paper size if available.
set BORDERLESS=true
REM Optional: exact paper size name exposed by your printer driver (recommended).
REM Examples: Letter (Borderless) / A4 (Borderless)
set BORDERLESS_PAPER_SIZE=Letter (Borderless)
REM Default paper size when BORDERLESS paper isn't available
set DEFAULT_PAPER_SIZE=Letter

echo Configuration:
echo   Server: %CLOUD_SERVER_URL%
echo   Printer: %DEFAULT_PRINTER%
echo   Poll Interval: %POLL_INTERVAL%ms
echo   Duplex: %DEFAULT_DUPLEX_SIDE%
echo   Borderless: %BORDERLESS%
echo   Borderless Paper: %BORDERLESS_PAPER_SIZE%
echo   Default Paper: %DEFAULT_PAPER_SIZE%
echo.

REM Ensure dependencies are installed (node_modules)
if not exist "node_modules\" (
  echo Dependencies not found (node_modules missing). Installing...
  npm install --omit=dev
  if errorlevel 1 (
    echo ERROR: npm install failed. Install Node.js 18/20 LTS and try again.
    pause
    exit /b 1
  )
  echo Dependencies installed.
  echo.
)

node local-print-agent.js

pause

