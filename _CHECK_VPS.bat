@echo off
title Diagnostico VPS - Database
set "PLINK=%~dp0tools\plink.exe"
set "VPS=root@177.153.202.47"
set "PW=69608206Ru@n"

echo y | "%PLINK%" -ssh -pw "%PW%" %VPS% "exit" >nul 2>&1

echo === .ENV NA VPS (apenas chaves sem valor secreto) ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "cd /opt/aios && grep -vE '(PASS|SECRET|KEY)=' .env; echo '---'; for k in DB_PASS JWT_SECRET ENCRYPTION_KEY DATABASE_PASS; do v=$(grep \"^$k=\" .env | cut -d= -f2); echo \"$k length=${#v}\"; done"

echo.
echo === ENV DENTRO DO CONTAINER BACKEND (sem secrets) ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker exec aios_backend env 2>/dev/null | grep -vE '(PASS|SECRET|KEY)=' | grep -E 'DATABASE|NODE|PORT|DB_' 2>/dev/null || echo 'container nao rodando'"

echo.
echo === DATABASE_PASS NO CONTAINER (apenas tamanho) ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker exec aios_backend sh -c 'v=$DATABASE_PASS; echo DATABASE_PASS_length=${#v}' 2>/dev/null || echo 'container nao rodando'"

echo.
echo === STATUS DOS CONTAINERS ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker ps -a --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo === LOGS BACKEND ULTIMAS 30 LINHAS ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker logs aios_backend --tail 30 2>&1"

echo.
pause
