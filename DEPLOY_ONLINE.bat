@echo off
cd /d "%~dp0"

echo =====================================================================
echo Iniciando Deploy Automatico: Vercel e Fly.io
echo =====================================================================
echo.

echo [1/2] Publicando Dashboard na Vercel...
echo.
cd apps\dashboard
call npx vercel --prod --yes --scope projeto-capital-prime-s-projects
cd ..\..

echo.
echo [2/2] Publicando Backend no Fly.io...
echo.
call "%USERPROFILE%\.fly\bin\flyctl.exe" deploy --config apps\backend\fly.toml .

echo.
echo =====================================================================
echo Processo de Deploy Finalizado!
echo =====================================================================
pause
