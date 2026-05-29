@echo off
title CHECK LOGIN ERROR
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "PLINK_PATH=%~dp0tools\plink.exe"

echo === Logs backend ultimas 50 linhas (procurando 500/login) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_backend --tail 50 2>&1"

echo.
echo === Teste direto na VPS: POST /api/v1/auth/login ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -s -w '\nHTTP=%%{http_code}\n' -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"ruan@capitalprime.local\",\"password\":\"teste\"}'"

echo.
echo === Existe usuario seed no DB? ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker exec aios_postgres psql -U aios -d aios_db -c 'SELECT id, email, role FROM users;' 2>&1"

echo.
echo === Quais rotas o backend expoe? ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_backend 2>&1 | grep -E 'Mapped|RouterExplorer' | head -30"

pause
