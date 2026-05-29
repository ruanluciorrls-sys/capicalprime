@echo off
title FIX VPS - Resetar Postgres e re-deployar
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "VPS_DIR=/opt/aios"
set "PLINK_PATH=%~dp0tools\plink.exe"
set "PSCP_PATH=%~dp0tools\pscp.exe"
set "DEPLOY_TAR=%~dp0tools\aios-deploy.tar.gz"

if not exist "%PLINK_PATH%" (
    echo plink/pscp nao encontrados. Rode SOLUCAO_FINAL.bat antes.
    pause & exit /b 1
)

echo ============================================================
echo  FIX VPS - Postgres reset + redeploy
echo ============================================================
echo.
echo Este script vai:
echo   1. Empacotar o codigo local atualizado (com fix de SSL)
echo   2. Enviar pra VPS
echo   3. Derrubar todos os containers
echo   4. APAGAR o volume do Postgres (dados serao perdidos)
echo   5. Subir tudo de novo com a config correta
echo.
choice /C SN /N /M "Continuar? Os dados do Postgres na VPS serao apagados [S/N]: "
if errorlevel 2 (
    echo Cancelado.
    pause & exit /b 0
)

:: -------- empacotar local --------
echo.
echo [1/5] Empacotando codigo local...
if exist "%DEPLOY_TAR%" del /F /Q "%DEPLOY_TAR%" >nul 2>nul
pushd "%~dp0"
tar -czf "%DEPLOY_TAR%" ^
  --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=dist ^
  --exclude=.git --exclude=tools --exclude=.env.local ^
  --exclude=data --exclude=*.db --exclude=*.db-journal --exclude=*.sqlite ^
  --exclude=*.log --exclude=logs --exclude=.cache --exclude=coverage ^
  --exclude=.vscode --exclude=.idea --exclude=*.tar.gz .
popd
if not exist "%DEPLOY_TAR%" (
    echo [ERRO] Falha ao empacotar
    pause & exit /b 1
)
for %%A in ("%DEPLOY_TAR%") do echo [OK] Pacote: %%~zA bytes

:: -------- enviar --------
echo.
echo [2/5] Enviando para VPS...
echo y | "%PLINK_PATH%" -ssh -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "exit" >nul 2>&1
"%PSCP_PATH%" -batch -pw "%VPS_PASS%" "%DEPLOY_TAR%" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/aios-deploy.tar.gz
if errorlevel 1 (
    echo [ERRO] Falha ao enviar
    pause & exit /b 1
)
echo [OK] Pacote enviado

:: -------- derrubar containers + volume --------
echo.
echo [3/5] Derrubando containers e apagando volume Postgres...
echo ------------------------------------------------------------
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml down -v 2>&1 | tail -20"
echo ------------------------------------------------------------

:: -------- extrair novo codigo --------
echo.
echo [4/5] Extraindo novo codigo...
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && tar -xzf aios-deploy.tar.gz && rm -f aios-deploy.tar.gz && echo OK"

:: -------- subir tudo limpo --------
echo.
echo [5/5] Rebuildando e subindo containers (pode levar 2-5 minutos)...
echo ------------------------------------------------------------
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml --env-file .env up --build -d 2>&1 | tail -50"
echo ------------------------------------------------------------

:: -------- aguardar e checar --------
echo.
echo Aguardando 30s para os servicos subirem...
timeout /t 30 /nobreak >nul

echo.
echo Status final dos containers:
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo.
echo Testando backend (deve retornar JSON):
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -sf http://localhost:3001/api/v1/health || echo 'BACKEND NAO RESPONDEU'"

echo.
echo Testando dashboard (deve retornar HTML):
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -sf -o /dev/null -w 'HTTP %%{http_code}\n' http://localhost:3000 || echo 'DASHBOARD NAO RESPONDEU'"

del /F /Q "%DEPLOY_TAR%" >nul 2>nul

echo.
echo ============================================================
echo  Pronto. Acesse http://%VPS_HOST%:3000
echo ============================================================
pause
