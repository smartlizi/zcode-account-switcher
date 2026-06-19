@echo off
REM ============================================================
REM  ZCode Account Switcher - Desktop launcher
REM  ASCII-only messages avoid Windows code page garbling.
REM ============================================================
title ZCode Account Switcher

cd /d "%~dp0desktop"
if errorlevel 1 (
  echo [ERROR] Cannot enter desktop directory: %~dp0desktop
  pause
  exit /b 1
)

REM Clear this variable. If it is set to 1, Electron runs as Node and no window appears.
set "ELECTRON_RUN_AS_NODE="

echo ============================================
echo   ZCode Account Switcher - Desktop
echo ============================================
echo.

if not exist "node_modules\electron\dist\electron.exe" (
  echo [SETUP] Installing desktop dependencies. This may take a few minutes...
  set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Try manually: cd desktop ^&^& npm install
    pause
    exit /b 1
  )
  echo [OK] Dependencies installed.
  echo.
)

if not exist "dist-renderer\index.html" (
  echo [BUILD] Building renderer...
  call npm run build
  if errorlevel 1 (
    echo.
    echo [ERROR] Renderer build failed.
    pause
    exit /b 1
  )
  echo [OK] Renderer built.
  echo.
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo [ERROR] electron.exe was not found after installation.
  pause
  exit /b 1
)

echo [START] Launching desktop app...
start "" "node_modules\electron\dist\electron.exe" .
echo.
echo If no window appears, check desktop\main.log.
echo You may close this console window.
