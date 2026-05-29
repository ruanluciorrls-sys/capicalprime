@echo off
title CORRIGIR .ENV DO VPS
cd /d "%~dp0"
setlocal EnableDelayedExpansion

set "PLINK=%~dp0tools\plink.exe"
set "PSCP=%~dp0tools\pscp.exe"
set "VPS=root@177.153.202.47"
set "PW=69608206Ru@n"
set "VPS_DIR=/opt/aios"
set "ENV_TMP=%~dp0tools\production_fix.env"

echo ============================================================
echo  CORRECAO DO .ENV DE PRODUCAO NO VPS
echo ============================================================
echo.

:: Cachear host key
echo y | "%PLINK%" -ssh -pw "%PW%" %VPS% "exit" >nul 2>&1

:: Gerar secrets fortes
echo [1/5] Gerando secrets de producao...
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "DB_PASS_NEW=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "ENCRYPTION_KEY=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"') do set "JWT_SECRET=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"') do set "WEBHOOK_SECRET=%%a"

if "!DB_PASS_NEW!" == "" (
    echo [ERRO] Node.js nao encontrado ou falha ao gerar secrets.
    echo Instale Node.js e tente novamente.
    pause & exit /b 1
)

echo [OK] Secrets gerados
echo      DB_PASS length: !DB_PASS_NEW:~0,4!... ^(32 bytes hex^)
echo      ENCRYPTION_KEY: 64 chars hex
echo      JWT_SECRET: 128 chars hex
echo.

:: Escrever .env de producao
echo [2/5] Escrevendo .env de producao...
(
    echo NODE_ENV=production
    echo PORT=3001
    echo DATABASE_TYPE=postgres
    echo DATABASE_HOST=db
    echo DATABASE_PORT=5432
    echo DATABASE_USER=aios
    echo DB_PASS=!DB_PASS_NEW!
    echo DATABASE_NAME=aios_db
    echo DB_SSL=false
    echo DB_SYNC=true
    echo DB_POOL_SIZE=20
    echo JWT_SECRET=!JWT_SECRET!
    echo JWT_EXPIRES_IN=30d
    echo PUBLIC_URL=http://177.153.202.47:3001
    echo PUBLIC_WS_URL=ws://177.153.202.47:3001
    echo CORS_ORIGINS=http://177.153.202.47:3000,http://177.153.202.47,chrome-extension://
    echo WEBHOOK_SECRET=!WEBHOOK_SECRET!
    echo ENCRYPTION_KEY=!ENCRYPTION_KEY!
    echo ASAAS_BASE_URL=https://api.asaas.com/v3
) > "!ENV_TMP!"

:: Converter CRLF -> LF
powershell -NoProfile -Command "$c=[IO.File]::ReadAllText('!ENV_TMP!') -replace \"`r`n\",\"`n\"; [IO.File]::WriteAllText('!ENV_TMP!',$c)"
echo [OK] .env escrito com LF endings
echo.

:: Validar tamanhos
for /f "delims=" %%a in ('powershell -NoProfile -Command "(Get-Content '!ENV_TMP!' | Select-String '^DB_PASS=').ToString().Split('=',2)[1].Length"') do set "PASS_LEN=%%a"
echo      Validacao DB_PASS no arquivo: !PASS_LEN! chars
if !PASS_LEN! LSS 10 (
    echo [ERRO] DB_PASS muito curto - abortando
    pause & exit /b 1
)
echo.

:: Upload .env para VPS
echo [3/5] Enviando .env para VPS...
"%PSCP%" -batch -pw "%PW%" "!ENV_TMP!" %VPS%:%VPS_DIR%/.env
if errorlevel 1 (
    echo [ERRO] Falha no PSCP. Verifique conexao.
    pause & exit /b 1
)
echo [OK] .env enviado
del /F /Q "!ENV_TMP!" >nul 2>nul
echo.

:: Dropar volume do Postgres e recriar containers
echo [4/5] Recriando containers com nova senha...
echo      ^(Postgres volume sera apagado - banco sera reiniciado do zero^)
echo ------------------------------------------------------------
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "cd %VPS_DIR% && sed -i 's/\r$//' .env && echo '--- Derrubando tudo ---' && docker compose -f docker-compose.production.yml down -v 2>&1 && echo '--- Subindo containers ---' && docker compose -f docker-compose.production.yml --env-file .env up --build -d 2>&1 | tail -20"
echo ------------------------------------------------------------
echo.

:: Aguardar e validar
echo [5/5] Aguardando 35s para containers iniciarem...
timeout /t 35 /nobreak >nul

echo.
echo === STATUS CONTAINERS ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo === TESTE BACKEND ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "curl -sf -m 8 http://localhost:3001/api/v1/health && echo '[OK] Backend respondendo' || echo '[ERRO] Backend nao respondeu'"

echo.
echo === LOGS BACKEND (possiveis erros) ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "docker logs aios_backend --tail 20 2>&1"

echo.
echo === VALIDACAO .ENV NO VPS ===
"%PLINK%" -ssh -batch -pw "%PW%" %VPS% "cd %VPS_DIR% && for k in DB_PASS JWT_SECRET ENCRYPTION_KEY NODE_ENV DATABASE_TYPE; do v=$(grep \"^$k=\" .env | cut -d= -f2); echo \"$k: primeiros4=${v:0:4} length=${#v}\"; done"

echo.
echo ============================================================
echo  CORRECAO CONCLUIDA
echo  Acesse: http://177.153.202.47:3000
echo  Login: ruanluciorrls@gmail.com / 69608206
echo ============================================================
pause
