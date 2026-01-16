@echo off
REM Batch script to update sw_templates table in Supabase

echo ================================================================================
echo   Supabase sw_templates Update Script
echo ================================================================================
echo.

echo [1/3] Installing dependencies...
pip install -r scripts/requirements_supabase.txt --quiet
if %ERRORLEVEL% NEQ 0 (
    echo   Failed to install dependencies
    pause
    exit /b 1
)
echo   Dependencies installed

echo.
echo [2/3] Running DRY-RUN (preview only)...
echo.
python scripts/update_sw_templates.py --dry-run

echo.
set /p PROCEED="Do you want to proceed with the actual update? [y/N]: "
if /i "%PROCEED%"=="y" (
    echo.
    echo [3/3] Running ACTUAL update...
    echo.
    python scripts/update_sw_templates.py
) else (
    echo.
    echo Update cancelled.
)

echo.
echo ================================================================================
echo   Complete!
echo ================================================================================
echo.
pause

