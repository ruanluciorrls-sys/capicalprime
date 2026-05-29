@echo off
chcp 65001 > nul
title Capital Prime - Instalador da Extensao Chrome

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        Capital Prime - Extensão Chrome              ║
echo  ║          Assistente de Instalação v2.3.0            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  PASSO 1: Este script vai abrir o Chrome nas Extensões.
echo.
echo  PASSO 2: Ative o "Modo desenvolvedor" (toggle no
echo           canto superior direito da tela).
echo.
echo  PASSO 3: Clique em "Carregar sem compactação".
echo.
echo  PASSO 4: Selecione a PASTA que contém este arquivo:
echo           %~dp0
echo.
echo  PASSO 5: A extensão aparecerá na lista. Pronto!
echo.
echo  ─────────────────────────────────────────────────────
echo  Se precisar ATUALIZAR depois de baixar nova versão:
echo   → Baixe o novo ZIP, extraia na mesma pasta
echo   → Vá em chrome://extensions e clique ↺ Atualizar
echo  ─────────────────────────────────────────────────────
echo.
echo  Pressione qualquer tecla para abrir o Chrome...
pause > nul

start "" "chrome.exe" "chrome://extensions"
if errorlevel 1 (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "chrome://extensions"
)
if errorlevel 1 (
  start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" "chrome://extensions"
)

echo.
echo  Chrome aberto em chrome://extensions
echo  Selecione a pasta: %~dp0
echo.
pause
