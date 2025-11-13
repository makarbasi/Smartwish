@echo off
REM Simple batch launcher for card search

echo.
echo =================================
echo   CARD SEARCH
echo =================================
echo.

REM Check if API key is set
if not defined GOOGLE_API_KEY (
    set /p GOOGLE_API_KEY="Enter your Google API Key: "
)

if "%GOOGLE_API_KEY%"=="" (
    echo Error: No API key provided
    pause
    exit /b 1
)

echo Starting search...
echo.

python scripts\search_cards.py

echo.
echo Search ended. Goodbye!
pause

