@echo off
color 0A
cd /d "%~dp0"

echo =====================================================================
echo  ATUALIZADOR AUTOMATICO DO SISTEMA (DASHBOARD E BACKEND)
echo =====================================================================
echo.
echo Pressione qualquer tecla para começar a atualizar o seu site no ar...
pause >nul

echo.
echo [1/2] Salvando e enviando as alteracoes para o GitHub...
echo (A Vercel vai detectar isso automaticamente e atualizar o Dashboard)
echo.
git add .
git commit -m "Atualizacao rapida do site"
git push origin master

echo.
echo [2/2] Publicando as alteracoes do Backend no Fly.io...
echo.
call "%USERPROFILE%\.fly\bin\flyctl.exe" deploy --config apps\backend\fly.toml .

echo.
echo =====================================================================
echo TUDO PRONTO! 
echo.
echo O Vercel (Dashboard) ja esta processando a atualizacao em background.
echo O Fly.io (Backend) ja foi atualizado.
echo =====================================================================
pause
