@echo off
title AIOS - Sistema Completo + Deploy VPS
color 0A
setlocal EnableDelayedExpansion
set "MODE_DEPLOY_ONLY=0"
set "MODE_AUTO_DEPLOY=1"
set "MODE_HOLD_WINDOW=1"

for %%A in (%*) do (
    if /I "%%~A"=="MANUAL" (
        set "MODE_AUTO_DEPLOY=0"
        set "MODE_HOLD_WINDOW=1"
    )
    if /I "%%~A"=="NO_PAUSE" set "MODE_HOLD_WINDOW=0"
    if /I "%%~A"=="DEPLOY_ONLY" set "MODE_DEPLOY_ONLY=1"
    if /I "%%~A"=="AUTO_DEPLOY" (
        set "MODE_DEPLOY_ONLY=1"
        set "MODE_AUTO_DEPLOY=1"
        set "MODE_HOLD_WINDOW=0"
    )
)

:: ============================================================
::  CONFIGURACOES â€” edite somente este bloco
:: ============================================================
set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "VPS_DIR=/opt/aios"
set "DOMAIN=pixcapitalprime.com.br"
set "API_DOMAIN=api.pixcapitalprime.com.br"
REM Dominio FALLBACK (hostname do VPS na KingHost, ja resolve no painel DNS)
set "FB_DOMAIN=capitaprimeofc.vps-kinghost.net"
set "FB_API_DOMAIN=api.capitaprimeofc.vps-kinghost.net"

set "ROOT=%~dp0"
set "TOOLS=%ROOT%tools"
set "PLINK=%TOOLS%\plink.exe"
set "PSCP=%TOOLS%\pscp.exe"
set "DEPLOY_TAR=%TOOLS%\aios-deploy.tar.gz"
set "ENV_TMP=%TOOLS%\_env_prod.tmp"
set "ENV_PROD=%TOOLS%\_env_vps_salvo.env"

cd /d "%ROOT%"

:: ============================================================
::  BANNER
:: ============================================================
echo.
echo  ============================================================
echo         AIOS  â€”  SISTEMA COMPLETO + DEPLOY VPS
echo  ============================================================
echo.

if "%MODE_DEPLOY_ONLY%"=="1" (
    echo [MODO] Deploy only ativado.
    echo.
    goto :deploy_section
)

:: ============================================================
::  [1/5]  PORTAS
:: ============================================================
echo [1/5] Liberando portas 3000 e 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
timeout /t 2 /nobreak >nul
echo [OK] Portas liberadas
echo.

:: ============================================================
::  [2/5]  CACHE
:: ============================================================
echo [2/5] Limpando cache .next do dashboard...
if exist "apps\dashboard\.next" (
    rmdir /s /q "apps\dashboard\.next" >nul 2>nul
    echo [OK] Cache removido
) else (
    echo [OK] Sem cache para limpar
)
echo.

:: ============================================================
::  [3/5]  BACKEND LOCAL
:: ============================================================
echo [3/5] Iniciando BACKEND (porta 3001)...
start "BACKEND AIOS" "%ROOT%_start_backend.bat"
echo      Aguardando backend (ate 20s)...
set "BACKEND_OK=0"
for /L %%i in (1,1,10) do (
    powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://localhost:3001/api/v1/health' -UseBasicParsing -TimeoutSec 2;if($r.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>nul
    if !errorlevel! == 0 ( set "BACKEND_OK=1" & goto :backend_done )
    timeout /t 2 /nobreak >nul
)
:backend_done
if "!BACKEND_OK!"=="1" ( echo [OK] Backend respondendo ) else ( echo [AVISO] Backend ainda nao respondeu - continuando )
echo.

:: ============================================================
::  [4/5]  DASHBOARD LOCAL
:: ============================================================
echo [4/5] Iniciando DASHBOARD (porta 3000)...
start "DASHBOARD AIOS" "%ROOT%_start_dashboard.bat"
timeout /t 6 /nobreak >nul
echo [OK] Dashboard iniciando
echo.

:: ============================================================
::  [5/5]  NAVEGADOR
:: ============================================================
echo [5/5] Abrindo navegador...
timeout /t 2 /nobreak >nul
start chrome http://localhost:3000
echo [OK] Navegador aberto
echo.

:: ============================================================
::  DEPLOY VPS  (opcional)
:: ============================================================
:deploy_section
echo  ============================================================
echo                      DEPLOY VPS
echo  ============================================================
if "%VPS_HOST%"=="" (
    echo [SKIP] VPS_HOST nao configurado.
    goto :fim
)

echo  Servidor: %VPS_USER%@%VPS_HOST%
echo.
if "%MODE_AUTO_DEPLOY%"=="1" (
    echo [AUTO] Deploy confirmado automaticamente.
) else (
    choice /C SN /N /M "  Enviar atualizacoes para o VPS agora? [S=Sim / N=Pular]: "
    if errorlevel 2 ( echo [SKIP] Deploy ignorado. & goto :fim )
)
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D1  FERRAMENTAS  (baixa plink / pscp se nao existirem)
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D1] Verificando ferramentas SSH...
if not exist "%TOOLS%" mkdir "%TOOLS%"

if not exist "%PLINK%" (
    echo      Baixando plink.exe...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe' -OutFile '%PLINK%' -UseBasicParsing"
    if not exist "%PLINK%" goto :err_plink
)
if not exist "%PSCP%" (
    echo      Baixando pscp.exe...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://the.earth.li/~sgtatham/putty/latest/w64/pscp.exe' -OutFile '%PSCP%' -UseBasicParsing"
    if not exist "%PSCP%" goto :err_pscp
)
echo [OK] plink e pscp prontos
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D2  CONEXAO SSH
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D2] Testando conexao SSH...
echo y | "%PLINK%" -ssh -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "exit" >nul 2>&1
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "mkdir -p %VPS_DIR%"
if errorlevel 1 goto :err_ssh
echo [OK] VPS acessivel
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D3  VALIDAR .env NA VPS  (gera e envia se invalido)
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D3] Verificando .env na VPS...
:: Valida apenas credenciais do banco (DB_PASS e ENCRYPTION_KEY).
:: URLs como PUBLIC_WS_URL sao injetadas pelo D6a sem precisar recriar o banco.
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "test -f %VPS_DIR%/.env && awk -F= '/^DB_PASS=/{if(length($2)>9)f1=1} /^ENCRYPTION_KEY=/{if(length($2)==64)f2=1} END{exit !(f1&&f2)}' %VPS_DIR%/.env" >nul 2>&1
set "ENV_VALID=%errorlevel%"

if "%ENV_VALID%"=="0" (
    echo [OK] .env valido â€” baixando copia local para proteger durante deploy...
    "%PSCP%" -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/.env "%ENV_PROD%" >nul 2>&1
    if not exist "%ENV_PROD%" (
        echo [ERRO] Nao foi possivel baixar o .env da VPS.
        if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 18) else (endlocal & exit /b 18)
    )
    echo [OK] .env salvo localmente
    echo.
    goto :empacotar
)

echo.
echo  [AVISO] .env invalido ou ausente na VPS.
echo  O banco de dados sera REINICIADO do zero.
echo.
if "%MODE_AUTO_DEPLOY%"=="1" (
    echo [AUTO] Confirmado automaticamente: gerar novo .env e recriar banco.
) else (
    choice /C SN /N /M "  Gerar novo .env e recriar banco? [S=Sim / N=Cancelar]: "
    if errorlevel 2 goto :cancelado
)

echo.
echo  Gerando secrets seguros...
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "DB_PASS_NEW=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "ENC_KEY=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"') do set "JWT_SECRET=%%a"
for /f "delims=" %%a in ('node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"') do set "WH_SECRET=%%a"
if "!DB_PASS_NEW!"=="" goto :err_node

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
    echo PUBLIC_URL=http://%VPS_HOST%:3001
    echo PUBLIC_WS_URL=ws://%VPS_HOST%:3001
    echo NEXT_PUBLIC_API_URL=http://%VPS_HOST%:3001
    echo EXTENSION_PUBLIC_API_BASE_URL=http://%VPS_HOST%:3001
    echo EXTENSION_FORCE_PUBLIC_ORIGIN=http://%VPS_HOST%:3001
    echo NEXT_PUBLIC_APP_URL=http://%VPS_HOST%:3000
    echo NEXT_PUBLIC_WS_URL=ws://%VPS_HOST%:3001
    echo BACKEND_URL=http://%VPS_HOST%:3001
    echo CORS_ORIGINS=http://%VPS_HOST%:3000,http://%VPS_HOST%:3001,http://%VPS_HOST%,chrome-extension://
    echo WEBHOOK_SECRET=!WH_SECRET!
    echo ENCRYPTION_KEY=!ENC_KEY!
    echo BANK_ADAPTER=mock
    echo ASAAS_BASE_URL=https://api.asaas.com/v3
    echo THROTTLE_TTL=60
    echo THROTTLE_LIMIT=100
    echo WS_THROTTLE_TTL=1000
    echo WS_THROTTLE_LIMIT=5
) > "!ENV_TMP!"

powershell -NoProfile -Command "$c=[IO.File]::ReadAllText('!ENV_TMP!') -replace \"`r`n\",\"`n\"; [IO.File]::WriteAllText('!ENV_TMP!',$c)"

echo  Enviando .env para a VPS...
"%PSCP%" -batch -pw "%VPS_PASS%" "!ENV_TMP!" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/.env
if errorlevel 1 ( if exist "!ENV_TMP!" del /F /Q "!ENV_TMP!" & goto :err_scp_env )

:: Salva copia local do .env de producao para proteger durante o deploy
copy /Y "!ENV_TMP!" "%ENV_PROD%" >nul 2>nul
if not exist "%ENV_PROD%" (
    echo [ERRO] Falha ao salvar copia local do .env.
    if exist "!ENV_TMP!" del /F /Q "!ENV_TMP!" >nul 2>nul
    if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 18) else (endlocal & exit /b 18)
)
if exist "!ENV_TMP!" del /F /Q "!ENV_TMP!" >nul 2>nul

echo  Derrubando containers + volume do banco...
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && sed -i 's/\r$//' .env && docker compose -f docker-compose.production.yml down -v 2>&1 | tail -5"
echo [OK] .env novo gerado e banco zerado
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D4  EMPACOTAR CODIGO LOCAL  (exclui .env e arquivos grandes)
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
:empacotar
echo [D4] Empacotando codigo local...
if exist "%DEPLOY_TAR%" del /F /Q "%DEPLOY_TAR%" >nul 2>nul

tar -czf "%DEPLOY_TAR%" ^
  --exclude=node_modules ^
  --exclude=.next ^
  --exclude=.turbo ^
  --exclude=dist ^
  --exclude=.git ^
  --exclude=tools ^
  --exclude=.env ^
  --exclude=.env.local ^
  --exclude=.env.development ^
  --exclude=.env.production ^
  --exclude=data ^
  --exclude=*.db ^
  --exclude=*.db-journal ^
  --exclude=*.sqlite ^
  --exclude=*.log ^
  --exclude=logs ^
  --exclude=.cache ^
  --exclude=coverage ^
  --exclude=.vscode ^
  --exclude=.idea ^
  --exclude=*.tar.gz ^
  .

if not exist "%DEPLOY_TAR%" goto :err_tar
for %%A in ("%DEPLOY_TAR%") do if %%~zA LSS 1024 goto :err_tar
for %%A in ("%DEPLOY_TAR%") do echo [OK] Pacote criado: %%~zA bytes
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D5  ENVIAR VIA SCP
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D5] Enviando para a VPS...
"%PSCP%" -batch -pw "%VPS_PASS%" "%DEPLOY_TAR%" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/aios-deploy.tar.gz
if errorlevel 1 goto :err_scp
if exist "%DEPLOY_TAR%" del /F /Q "%DEPLOY_TAR%" >nul 2>nul
echo [OK] Codigo enviado
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D6a  EXTRAIR CODIGO NA VPS
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D6] Extraindo codigo na VPS...
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && tar -xzf aios-deploy.tar.gz; rm -f aios-deploy.tar.gz; echo '[OK] extracao concluida'"
if errorlevel 1 (
    echo [ERRO] Falha ao extrair codigo na VPS.
    if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 17) else (endlocal & exit /b 17)
)

:: Re-envia o .env de producao salvo localmente â€” garante que o tar nao sobrescreveu
echo      Restaurando .env de producao na VPS...
"%PSCP%" -batch -pw "%VPS_PASS%" "%ENV_PROD%" %VPS_USER%@%VPS_HOST%:%VPS_DIR%/.env
if errorlevel 1 (
    echo [ERRO] Falha ao restaurar .env na VPS.
    if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 18) else (endlocal & exit /b 18)
)
:: Remove CRLF que o Windows pode ter introduzido
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "sed -i 's/\r$//' %VPS_DIR%/.env"

:: Atualiza (upsert) as variaveis de URL para o IP publico atual.
:: Enquanto o DNS do dominio nao resolver, painel e extensao precisam usar IP:porta.
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && sed -i -e '/^PUBLIC_URL=/d' -e '/^PUBLIC_WS_URL=/d' -e '/^NEXT_PUBLIC_API_URL=/d' -e '/^NEXT_PUBLIC_WS_URL=/d' -e '/^NEXT_PUBLIC_APP_URL=/d' -e '/^EXTENSION_PUBLIC_API_BASE_URL=/d' -e '/^EXTENSION_FORCE_PUBLIC_ORIGIN=/d' -e '/^BACKEND_URL=/d' -e '/^CORS_ORIGINS=/d' .env && echo 'PUBLIC_URL=http://%VPS_HOST%:3001' >> .env && echo 'PUBLIC_WS_URL=ws://%VPS_HOST%:3001' >> .env && echo 'NEXT_PUBLIC_API_URL=http://%VPS_HOST%:3001' >> .env && echo 'NEXT_PUBLIC_WS_URL=ws://%VPS_HOST%:3001' >> .env && echo 'NEXT_PUBLIC_APP_URL=http://%VPS_HOST%:3000' >> .env && echo 'EXTENSION_PUBLIC_API_BASE_URL=http://%VPS_HOST%:3001' >> .env && echo 'EXTENSION_FORCE_PUBLIC_ORIGIN=http://%VPS_HOST%:3001' >> .env && echo 'BACKEND_URL=http://%VPS_HOST%:3001' >> .env && echo 'CORS_ORIGINS=http://%VPS_HOST%:3000,http://%VPS_HOST%:3001,http://%VPS_HOST%,chrome-extension://' >> .env"
echo [OK] .env de producao atualizado para IP publico (%VPS_HOST%)
echo.

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D6b  DOCKER COMPOSE UP --BUILD
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
echo [D6] Reconstruindo containers (aguarde, pode levar alguns minutos)...
echo  ------------------------------------------------------------
:: Para containers antigos (estado de erro/restarting) antes de subir os novos
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml down 2>&1 | tail -3"
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml --env-file .env up --build -d 2>&1"
set "COMPOSE_EXIT=%errorlevel%"
echo  ------------------------------------------------------------

:: Limpeza de imagens antigas (silenciosa, nao afeta o resultado)
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker image prune -f" >nul 2>&1

if "%COMPOSE_EXIT%"=="0" goto :D7

:: â”€â”€ Compose falhou â€” coletar diagnostico automaticamente â”€â”€â”€â”€â”€â”€
echo.
echo  [ERRO] docker compose falhou. Coletando diagnostico...
echo.
echo  === STATUS CONTAINERS ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps -a --format 'table {{.Names}}\t{{.Status}}'"
echo.
echo  === LOGS POSTGRES ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_postgres --tail 20 2>&1"
echo.
echo  === LOGS BACKEND ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker logs aios_backend --tail 20 2>&1"
echo.
echo  === .env NA VPS (variaveis criticas) ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && for k in NODE_ENV DATABASE_TYPE DB_PASS ENCRYPTION_KEY; do v=$(grep \"^${k}=\" .env 2>/dev/null | cut -d= -f2); echo \"  ${k}: primeiros4=${v:0:4} len=${#v}\"; done"
echo.
echo  [DICA] Se 'DB_PASS len=0': rode o script novamente, escolha S para gerar novo .env.
echo  [DICA] Se 'postgres unhealthy': aguarde 30s e rode novamente (inicializacao lenta).
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 17) else (endlocal & exit /b 17)

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  D7  VERIFICACAO FINAL
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
:D7
echo [D7] Aguardando 20s para os containers iniciarem...
timeout /t 20 /nobreak >nul

echo.
echo  === CONTAINERS ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo  === BACKEND HEALTH ===
"%PLINK%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -sf -m 8 http://localhost:3001/api/v1/health && echo ' [OK] Backend online' || echo ' [ERRO] Backend nao respondeu'"

echo.
echo [OK] DEPLOY CONCLUIDO â€” http://%VPS_HOST%:3000
echo.

:: ============================================================
::  FIM
:: ============================================================
:fim
if exist "%ENV_PROD%" del /F /Q "%ENV_PROD%" >nul 2>nul
echo.
echo  ============================================================
echo                    SISTEMA OPERACIONAL!
echo  ============================================================
echo.
echo    BACKEND LOCAL:    http://localhost:3001
echo    FRONTEND LOCAL:   http://localhost:3000
if not "%VPS_HOST%"=="" echo    SITE ONLINE:      http://%VPS_HOST%:3000
echo.
if not "%MODE_DEPLOY_ONLY%"=="1" echo    ATENCAO: Nao feche as janelas BACKEND e DASHBOARD.
echo.
if "%MODE_HOLD_WINDOW%"=="1" pause
endlocal
exit /b 0

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  ROTULO CANCELAR
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
:cancelado
echo.
echo [SKIP] Deploy cancelado.
goto :fim

:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
::  ERROS
:: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
:err_plink
echo.
echo [ERRO] Nao foi possivel baixar plink.exe
echo        Verifique sua conexao com a internet.
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 10) else (endlocal & exit /b 10)

:err_pscp
echo.
echo [ERRO] Nao foi possivel baixar pscp.exe
echo        Verifique sua conexao com a internet.
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 11) else (endlocal & exit /b 11)

:err_node
echo.
echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 12) else (endlocal & exit /b 12)

:err_ssh
echo.
echo [ERRO] Nao foi possivel conectar ao VPS. Verifique:
echo        - VPS esta ligada e SSH habilitado?
echo        - Usuario e senha corretos?
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 13) else (endlocal & exit /b 13)

:err_scp_env
echo.
echo [ERRO] Falha ao enviar .env para a VPS.
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 14) else (endlocal & exit /b 14)

:err_tar
echo.
echo [ERRO] Falha ao empacotar o projeto.
echo        Necessario Windows 10/11 1803+ (tar nativo).
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 15) else (endlocal & exit /b 15)

:err_scp
echo.
echo [ERRO] Falha ao enviar codigo para a VPS.
if exist "%DEPLOY_TAR%" del /F /Q "%DEPLOY_TAR%" >nul 2>nul
if "%MODE_HOLD_WINDOW%"=="1" (pause & endlocal & exit /b 16) else (endlocal & exit /b 16)

