@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js e npm nao foram encontrados. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Dependencias nao encontradas. Execute npm install nesta pasta primeiro.
  pause
  exit /b 1
)

echo Iniciando o servidor de desenvolvimento...
call npm run dev
set "start_exit=%errorlevel%"
if not "%start_exit%"=="0" (
  echo O servidor encerrou com erro %start_exit%.
  pause
)
exit /b %start_exit%
