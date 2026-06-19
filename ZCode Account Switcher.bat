@echo off
REM ============================================================
REM  Direct Electron launcher - no install, no build.
REM  Use this after dependencies are already installed.
REM ============================================================
cd /d "%~dp0desktop"
if errorlevel 1 (
  echo [ERROR] Cannot enter desktop directory: %~dp0desktop
  pause
  exit /b 1
)

set "ELECTRON_RUN_AS_NODE="

if not exist "node_modules\electron\dist\electron.exe" (
  echo [ERROR] electron.exe not found:
  echo   %CD%\node_modules\electron\dist\electron.exe
  echo Run "Æô¶¯×ÀÃæ°æ.bat" first to install dependencies.
  pause
  exit /b 1
)

echo [START] Running Electron directly...
echo --- Electron output starts below ---
echo.

"node_modules\electron\dist\electron.exe" .

echo.
echo --- Electron exited ---
echo If there was an error, also check desktop\main.log.
pause
