@echo off
title DIAGNOSTICO VPS
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

set "VPS_HOST=177.153.202.47"
set "VPS_USER=root"
set "VPS_PASS=69608206Ru@n"
set "PLINK_PATH=%~dp0tools\plink.exe"

if not exist "%PLINK_PATH%" (
    echo plink.exe nao encontrado. Rode SOLUCAO_FINAL.bat primeiro.
    pause
    exit /b 1
)

echo ============================================================
echo  DIAGNOSTICO DA VPS - %VPS_HOST%
echo ============================================================
echo.

echo [1] Conteudo de /opt/aios/
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "ls -la /opt/aios/ 2>&1 | head -30"
echo.

echo [2] Arquivo .env existe?
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "[ -f /opt/aios/.env ] && echo SIM || echo NAO"
echo.

echo [3] Docker instalado?
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker --version 2>&1; docker compose version 2>&1"
echo.

echo [4] Containers ativos (docker ps)
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "docker ps -a 2>&1"
echo.

echo [5] Portas em uso
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "ss -tlnp 2>&1 | head -20"
echo.

echo [6] Ultimos logs do compose (50 linhas)
"%PLINK_PATH%" -ssh -batch -pw "%VPS_PASS%" %VPS_USER%@%VPS_HOST% "cd /opt/aios && docker compose -f docker-compose.production.yml logs --tail=50 2>&1 | tail -60"
echo.

echo ============================================================
echo  FIM DO DIAGNOSTICO - copie a saida acima e me envie
echo ============================================================
pause
