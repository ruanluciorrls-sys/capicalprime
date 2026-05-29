@echo off
title FORCE REGEN ENV - DEPLOY
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "PLINK_PATH=%~dp0tools\plink.exe"

echo ============================================================
echo  Forcando regeneracao do .env na VPS
echo ============================================================
echo.
echo Vai apagar o .env atual da VPS e o volume Postgres.
echo Sera regenerado pelo _DEPLOY.bat com PUBLIC_URL incluindo :3001
echo.
choice /C SN /N /M "Continuar? [S/N]: "
if errorlevel 2 (
    echo Cancelado.
    pause & exit /b 0
)

echo y | "%PLINK_PATH%" -ssh -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "exit" >nul 2>&1

echo Apagando .env da VPS...
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "rm -f /opt/aios/.env && echo OK"

echo.
echo Pronto. Agora rode _DEPLOY.bat - vai regenerar tudo com URL correta.
pause
