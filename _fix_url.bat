@echo off
title FIX PUBLIC_URL
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "VPS_DIR=/opt/aios"
set "PLINK_PATH=%~dp0tools\plink.exe"

echo ============================================================
echo  FIX PUBLIC_URL - adicionar :3001 e rebuildar dashboard
echo ============================================================
echo.
echo Vai:
echo  1. Atualizar PUBLIC_URL, PUBLIC_WS_URL e CORS_ORIGINS no .env da VPS
echo  2. Rebuildar APENAS o dashboard ^(pra pegar nova NEXT_PUBLIC_API_URL^)
echo  3. Reiniciar dashboard
echo.
echo Postgres e backend NAO sao mexidos. Dados preservados.
echo.
choice /C SN /N /M "Continuar? [S/N]: "
if errorlevel 2 (
    echo Cancelado.
    pause & exit /b 0
)

echo y | "%PLINK_PATH%" -ssh -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "exit" >nul 2>&1

echo.
echo [1/3] Atualizando .env...
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && sed -i 's|^PUBLIC_URL=.*|PUBLIC_URL=http://%VPS_HOST%:3001|' .env && sed -i 's|^PUBLIC_WS_URL=.*|PUBLIC_WS_URL=ws://%VPS_HOST%:3001|' .env && sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=http://%VPS_HOST%:3000,http://%VPS_HOST%,chrome-extension://|' .env && echo '---NOVO .env (3 linhas relevantes)---' && grep -E '^(PUBLIC_URL|PUBLIC_WS_URL|CORS_ORIGINS)' .env"

echo.
echo [2/3] Rebuildando e reiniciando dashboard ^(2-3 min^)...
echo ------------------------------------------------------------
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd %VPS_DIR% && docker compose -f docker-compose.production.yml --env-file .env up --build -d --no-deps --force-recreate dashboard 2>&1 | tail -25"
echo ------------------------------------------------------------

echo.
echo [3/3] Aguardando 20s e validando...
timeout /t 20 /nobreak >nul

echo.
echo === STATUS ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo === TESTE DASHBOARD ===
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "curl -s -o /dev/null -w 'HTTP %%{http_code}\n' -m 5 http://localhost:3000/login"

echo.
echo ============================================================
echo  Pronto! Acesse http://%VPS_HOST%:3000
echo  ^(use Ctrl+Shift+R no navegador para forcar reload^)
echo ============================================================
pause
