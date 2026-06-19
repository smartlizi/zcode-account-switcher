@echo off
REM ============================================================
REM  ZCode Account Switcher - Development mode launcher
REM ============================================================
title ZCode Account Switcher Dev

cd /d "%~dp0desktop"
if errorlevel 1 (
  echo [ERROR] Cannot enter desktop directory: %~dp0desktop
  pause
  exit /b 1
)

set "ELECTRON_RUN_AS_NODE="

if not exist "node_modules\electron\dist\electron.exe" (
  echo [SETUP] Installing desktop dependencies...
  set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo [DEV] Starting Vite dev server and Electron...
echo Edit files under desktop\renderer\ for hot reload.
echo.
call npm run dev
pause
