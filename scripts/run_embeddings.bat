@echo off
REM Batch script to run embedding generation
REM Usage: Edit the API key below, then run: scripts\run_embeddings.bat

REM ⚠️ REPLACE THIS WITH YOUR API KEY FROM: https://aistudio.google.com/app/apikey
set API_KEY=REPLACE_WITH_YOUR_API_KEY

REM Check if API key was replaced
if "%API_KEY%"=="REPLACE_WITH_YOUR_API_KEY" (
    echo ❌ ERROR: Please edit this script and replace the API key!
    echo.
    echo Steps:
    echo   1. Get your API key from: https://aistudio.google.com/app/apikey
    echo   2. Edit this file: scripts\run_embeddings.bat
    echo   3. Replace 'REPLACE_WITH_YOUR_API_KEY' with your actual key
    echo   4. Save and run again
    exit /b 1
)

REM Set environment variable
set GOOGLE_API_KEY=%API_KEY%

echo ========================================
echo   Embedding Generation Script
echo ========================================
echo.
echo API Key: %API_KEY:~0,20%...
echo.
echo Starting embedding generation...
echo.

REM Run the Python script
python scripts\generate_embeddings.py

REM Check if successful
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ Embedding generation completed!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ❌ Error occurred during execution
    echo ========================================
    echo.
    echo Troubleshooting:
    echo   1. Run test first: python scripts\test_api_key.py
    echo   2. Check API_KEY_SETUP_GUIDE.md for help
)

pause





