@echo off
title BACKEND - AI OS (porta 3001)
color 0B
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

echo.
echo  [BACKEND] Compilando e iniciando NestJS na porta 3001...
echo  Diretorio: %CD%
echo.

:: Build incremental (so recompila o que mudou)
echo  [1/2] Compilando backend...
call npm run build --workspace=@aios/backend
if errorlevel 1 (
    echo.
    echo  [ERRO] Build falhou. Veja os erros acima.
    pause
    exit /b 1
)

:: Build do pacote compartilhado tambem
echo  [2/2] Iniciando servidor...
echo.
node "apps\backend\dist\main.js"
pause
