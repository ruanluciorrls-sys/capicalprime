@echo off
title AI PROJECT OS - SISTEMA COMPLETO
color 0A
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

echo.
echo  ================================================
echo   AI PROJECT OS - Iniciando sistema completo
echo  ================================================
echo.
echo  [1/2] Iniciando Backend (porta 3001)...
start "BACKEND - AI OS (porta 3001)" cmd /k "cd /d \"C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM\" && color 0B && npm run dev --workspace=@aios/backend"

echo  Aguardando backend iniciar (5 segundos)...
timeout /t 5 /nobreak >nul

echo  [2/2] Iniciando Dashboard (porta 3000)...
start "DASHBOARD - AI OS (porta 3000)" cmd /k "cd /d \"C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM\" && color 0E && npm run dev --workspace=@aios/dashboard"

echo.
echo  ================================================
echo   Sistema iniciado! Acesse:
echo   Dashboard: http://localhost:3000
echo   Backend:   http://localhost:3001/api/v1/health
echo  ================================================
echo.
echo  Feche esta janela ou pressione qualquer tecla.
pause
