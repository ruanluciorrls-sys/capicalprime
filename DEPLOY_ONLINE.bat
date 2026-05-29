@echo off
cd /d "%~dp0"

echo =====================================================================
echo Iniciando Deploy Automatico de Todo o Sistema (Vercel e Fly.io)
echo =====================================================================
echo.

echo [1/2] Enviando codigo para o GitHub (Isso atualiza a Vercel automaticamente)...
echo.
git add .
git commit -m "Deploy automatico"
git push origin master

echo.
echo [2/2] Publicando Backend no Fly.io...
echo.
call "%USERPROFILE%\.fly\bin\flyctl.exe" deploy --config apps\backend\fly.toml .

echo.
echo =====================================================================
echo Processo de Deploy Finalizado!
echo =====================================================================
pause
