@echo off
color 0B
cd /d "%~dp0"

echo =====================================================================
echo  GERADOR DE BACKUP DO SISTEMA CAPITAL PRIME
echo =====================================================================
echo.
echo Gerando arquivo ZIP do sistema (isso pode demorar um pouquinho)...
echo Pastas node_modules e .next serao ignoradas para deixar o backup leve.
echo.

:: Pega a data e hora atual no formato YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "timestamp=%datetime:~0,8%_%datetime:~8,6%"
set "backup_name=Backup_CapitalPrime_v2.4.7_%timestamp%.zip"

:: Usa o PowerShell para zipar a pasta ignorando arquivos pesados
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $src = '%cd%'; $dst = '%cd%\%backup_name%'; $tempFolder = '%cd%\.temp_backup'; if (Test-Path $tempFolder) { Remove-Item $tempFolder -Recurse -Force }; New-Item -ItemType Directory -Path $tempFolder | Out-Null; Copy-Item -Path $src\* -Destination $tempFolder -Recurse -Exclude 'node_modules', '.next', '.git', 'dist', '.vercel', '*.zip', '.temp_backup' -Force; [System.IO.Compression.ZipFile]::CreateFromDirectory($tempFolder, $dst); Remove-Item $tempFolder -Recurse -Force"

echo.
echo =====================================================================
echo BACKUP CONCLUIDO COM SUCESSO!
echo.
echo O arquivo foi salvo na pasta do seu projeto com o nome:
echo %backup_name%
echo =====================================================================
pause
