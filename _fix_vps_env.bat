@echo off
title FIX VPS - Gerar .env correto e re-deployar
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "VPS_DIR=/opt/aios"
set "PLINK_PATH=%~dp0tools\plink.exe"
set "PSCP_PATH=%~dp0tools\pscp.exe"
set "ENV_TMP=%~dp0tools\production.env"

if not exist "%PLINK_PATH%" (
    echo plink nao encontrado. Rode SOLUCAO_FINAL.bat antes.
    pause & exit /b 1
)

echo ============================================================
echo  FIX VPS - Gerando .env de producao com secrets fortes
echo ============================================================
echo.

:: Gerar secrets aleatorios via PowerShell
echo Gerando secrets aleatorios...
for /f "delims=" %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')"') do set "DB_PASS_NEW=%%a"
for /f "delims=" %%a in ('powershell -NoProfile -Command "-join ((1..32) | %%{[byte](Get-Random -Min 0 -Max 256)} | %%{$_.ToString('x2')})"') do set "ENCRYPTION_KEY=%%a"
for /f "delims=" %%a in ('powershell -NoProfile -Command "-join ((1..128) | %%{[byte](Get-Random -Min 0 -Max 256)} | %%{$_.ToString('x2')})"') do set "JWT_SECRET=%%a"
for /f "delims=" %%a in ('powershell -NoProfile -Command "-join ((1..32) | %%{[byte](Get-Random -Min 0 -Max 256)} | %%{$_.ToString('x2')})"') do set "WEBHOOK_SECRET=%%a"

:: Montar o .env
echo Montando arquivo .env...
(
    echo NODE_ENV=production
    echo PORT=3001
    echo.
    echo # Banco de dados
    echo DB_USER=aios
    echo DB_PASS=%DB_PASS_NEW%
    echo DB_NAME=aios_db
    echo DB_SSL=false
    echo.
    echo # JWT
    echo JWT_SECRET=%JWT_SECRET%
    echo.
    echo # URLs publicas
    echo PUBLIC_URL=http://%VPS_HOST%
    echo PUBLIC_WS_URL=ws://%VPS_HOST%
    echo.
    echo # CORS
    echo CORS_ORIGINS=http://%VPS_HOST%,http://%VPS_HOST%:3000,chrome-extension://
    echo.
    echo # Seguranca
    echo WEBHOOK_SECRET=%WEBHOOK_SECRET%
    echo ENCRYPTION_KEY=%ENCRYPTION_KEY%
    echo.
    echo # Asaas
    echo ASAAS_BASE_URL=https://api.asaas.com/v3
) > "%ENV_TMP%"

echo [OK] .env gerado localmente
echo.
echo Conteudo do .env (sem secrets sensiveis^):
type "%ENV_TMP%" | findstr /v "DB_PASS JWT_SECRET ENCRYPTION_KEY WEBHOOK_SECRET"
echo.

:: Cachear host key e enviar
echo y | "%PLINK_PATH%" -ssh -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "exit" >nul 2>&1

echo Enviando .env para VPS...
"%PSCP_PATH%" -batch -pw "%VPS_PASS%" "%ENV_TMP%" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/.env
if errorlevel 1 (
    echo [ERRO] Falha ao enviar .env
    pause & exit /b 1
)
echo [OK] .env enviado

:: Apagar tmp local
del /F /Q "%ENV_TMP%" >nul 2>nul

:: Derrubar containers + volume e re-subir
echo.
echo Derrubando containers + volume Postgres e subindo de novo...
echo ------------------------------------------------------------
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml down -v 2>&1 | tail -10 && docker compose -f docker-compose.production.yml --env-file .env up --build -d 2>&1 | tail -20"
echo ------------------------------------------------------------

echo.
echo Aguardando 45s para servicos subirem...
timeout /t 45 /nobreak >nul

echo.
echo === Status final ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo.
echo === Logs backend (ultimas 15 linhas) ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml logs --tail=15 backend 2>&1 | tail -20"

echo.
echo === Teste backend ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -sf http://localhost:3001/api/v1/health && echo '' || echo 'BACKEND NAO RESPONDEU'"

echo.
echo === Teste dashboard ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -sf -o /dev/null -w 'HTTP %%{http_code}\n' http://localhost:3000 || echo 'DASHBOARD NAO RESPONDEU'"

echo.
echo ============================================================
echo  Pronto. Acesse http://%VPS_HOST%:3000
echo ============================================================
pause
