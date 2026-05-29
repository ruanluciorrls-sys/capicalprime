@echo off
title DASHBOARD - AI OS (porta 3000)
color 0D
cd /d "C:\Users\RUAN CPA\Documents\AI PROJECT OPERATING SYSTEM"
echo.
echo  [DASHBOARD] Iniciando Next.js na porta 3000...
echo  Diretorio: %CD%
echo.
set NODE_NO_DEPRECATION=1
npm run dev --workspace=@aios/dashboard
pause
