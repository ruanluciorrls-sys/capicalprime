@echo off
title CHECK VPS LOGS
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "PLINK_PATH=%~dp0tools\plink.exe"

echo === Status containers ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps -a --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo === Logs Postgres (ultimas 30 linhas) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_postgres --tail 30 2>&1"

echo.
echo === Logs Backend (ultimas 30 linhas) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_backend --tail 30 2>&1"

echo.
echo === Verificando .env (vars principais sem secret) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "grep -E '^(DB_USER|DB_NAME|DB_SSL|NODE_ENV|PORT)' /opt/aios/.env 2>&1"

echo.
echo === DB_PASS tem valor? (so mostra YES/NO) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "grep -q '^DB_PASS=..' /opt/aios/.env && echo 'DB_PASS=SIM (preenchido)' || echo 'DB_PASS=NAO (vazio!)'"

echo.
echo === ENCRYPTION_KEY tem 64 chars? ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "awk -F= '/^ENCRYPTION_KEY=/{print \"len=\" length($2)}' /opt/aios/.env"

pause
