@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\tsx" (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 exit /b 1
echo.
echo Open http://127.0.0.1:4317 after the running message appears.
echo Keep this window open. Press Ctrl+C to stop Mendroom.
call npm start
