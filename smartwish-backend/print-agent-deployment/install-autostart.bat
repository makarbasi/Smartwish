@echo off
REM ============================================
REM SmartWish Print Agent - Auto-Start Installer
REM ============================================
REM This script creates a shortcut in the Startup folder
REM so the print agent starts automatically when you log in.
REM ============================================

cd /d "%~dp0"

echo ============================================
echo SmartWish Print Agent Auto-Start Installer
echo ============================================
echo.

REM Get the current directory
set AGENT_DIR=%~dp0
set AGENT_DIR=%AGENT_DIR:~0,-1%

REM Create VBS script to make shortcut (Windows doesn't have mklink for shortcuts easily)
set VBS_FILE=%TEMP%\create_shortcut.vbs
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_FILE%"
echo sLinkFile = oWS.SpecialFolders("Startup") ^& "\SmartWish Print Agent.lnk" >> "%VBS_FILE%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_FILE%"
echo oLink.TargetPath = "%AGENT_DIR%\start-print-agent.bat" >> "%VBS_FILE%"
echo oLink.WorkingDirectory = "%AGENT_DIR%" >> "%VBS_FILE%"
echo oLink.Description = "SmartWish Local Print Agent" >> "%VBS_FILE%"
echo oLink.WindowStyle = 7 >> "%VBS_FILE%"
echo oLink.Save >> "%VBS_FILE%"

REM Run the VBS script
cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

echo.
echo ============================================
echo Installation complete!
echo ============================================
echo.
echo The SmartWish Print Agent will now start automatically
echo when you log into Windows.
echo.
echo To remove auto-start, delete this shortcut:
echo   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SmartWish Print Agent.lnk
echo.
echo On first run, you will need to pair this device with a kiosk.
echo After pairing, it will remember your kiosk and start automatically.
echo.
echo Would you like to start the print agent now? (Y/N)
set /p START_NOW=

if /i "%START_NOW%"=="Y" (
    echo.
    echo Starting print agent...
    start "" "%AGENT_DIR%\start-print-agent.bat"
)

echo.
pause
