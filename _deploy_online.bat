@echo off
title AIOS - Deploy Online (Unificado)
cd /d "%~dp0"

echo ============================================================
echo  DEPLOY ONLINE UNIFICADO
echo  Executando SOLUCAO_FINAL.bat em modo AUTO_DEPLOY...
echo ============================================================
echo.

call "%~dp0SOLUCAO_FINAL.bat" AUTO_DEPLOY
exit /b %errorlevel%
