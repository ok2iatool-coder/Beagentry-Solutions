@echo off
chcp 65001 >nul
title Beagentry - publicar la web
cd /d "%~dp0"

set "NODE=C:\Users\rdmat\tools\node-v24.19.0-win-x64\node.exe"
if not exist "%NODE%" (
  echo.
  echo   No encuentro Node en:
  echo   %NODE%
  echo.
  pause
  exit /b 1
)

echo.
echo   BEAGENTRY - publicar la web
echo   ---------------------------
echo   Sube lo que hayas cambiado en docs\ a GitHub Pages y a Hostinger.
echo.
set "MSG="
set /p "MSG=  Que has cambiado (Enter para dejarlo en blanco): "
if "%MSG%"=="" set "MSG=cambios en la web"
echo.

"%NODE%" publicar.mjs "%MSG%"

echo.
echo   Pulsa una tecla para cerrar.
pause >nul
