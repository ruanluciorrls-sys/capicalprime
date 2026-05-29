@echo off
title AI OS - LIMPEZA COMPLETA
color 0C

echo ============================================================
echo         LIMPEZA DE RESÍDUOS DO PROJETO
echo ============================================================
echo.

cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"

:: 1. Matar processos Node que estão usando as portas
echo [1/5] Matando processos Node nas portas 3000 e 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)
timeout /t 2 /nobreak >nul
echo [OK] Processos finalizados
echo.

:: 2. Limpar cache do npm
echo [2/5] Limpando cache do npm...
call npm cache clean --force >nul 2>nul
echo [OK] Cache limpo
echo.

:: 3. Remover node_modules de todos os workspaces (opcional, mais profundo)
echo [3/5] Deseja remover todas as pastas node_modules? (s/n)
set /p resp="> "
if /i "%resp%"=="s" (
    echo Removendo node_modules (pode levar alguns minutos)...
    rmdir /s /q node_modules 2>nul
    rmdir /s /q apps\backend\node_modules 2>nul
    rmdir /s /q apps\dashboard\node_modules 2>nul
    rmdir /s /q packages\extension\node_modules 2>nul
    rmdir /s /q packages\shared\node_modules 2>nul
    echo [OK] node_modules removidos
) else (
    echo Pulando remocao de node_modules
)
echo.

:: 4. Remover .next e dist (artefatos de build)
echo [4/5] Removendo artefatos de build...
rmdir /s /q apps\dashboard\.next 2>nul
rmdir /s /q apps\backend\dist 2>nul
rmdir /s /q packages\extension\dist 2>nul
rmdir /s /q packages\shared\dist 2>nul
echo [OK] Artefatos removidos
echo.

:: 5. Reinstalar dependências (opcional)
echo [5/5] Deseja reinstalar todas as dependencias? (s/n)
set /p resp2="> "
if /i "%resp2%"=="s" (
    echo Instalando dependencias (npm install)...
    call npm install
    echo [OK] Instalacao concluida
) else (
    echo Pulando reinstalacao
)

echo.
echo ============================================================
echo          LIMPEZA CONCLUIDA!
echo ============================================================
echo.
echo Recomendado: execute o script de inicio apos a limpeza.
pause