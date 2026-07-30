@echo off
cd /d "%~dp0"
call :ensure_server
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk http://localhost:8080/games/onyxia-run/ --edge-kiosk-type=fullscreen --no-first-run --user-data-dir=%LOCALAPPDATA%\EsfandGamesKiosk
exit /b

:ensure_server
netstat -ano | findstr /C:":8080 " | findstr LISTENING >nul
if errorlevel 1 (
  start "Esfand Games Server" /min cmd /c "node server.mjs"
  timeout /t 2 /nobreak >nul
)
exit /b
