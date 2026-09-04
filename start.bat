@echo off
REM ============================================================
REM  AI Running in Your Browser — Windows double-click launcher
REM  Just double-click this file. It starts the app and opens
REM  your browser automatically. Close the black window to stop.
REM ============================================================
cd /d "%~dp0"

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY set "PY=py"

echo ============================================================
echo   Please wait... starting the app and opening your browser.
echo ============================================================
%PY% start.py
if errorlevel 1 (
    echo.
    echo  [!] Could not launch. Make sure Python 3 is installed:
    echo      https://python.org/downloads
    echo.
    pause
)