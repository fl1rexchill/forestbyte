@echo off
chcp 65001 >nul
rem Локальный просмотр сайта WAVE: двойной клик по этому файлу.
rem Нужен Node.js (https://nodejs.org). Остановить сервер — закрыть окно или Ctrl+C.

cd /d "%~dp0public"

where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите его с https://nodejs.org и запустите этот файл снова.
  pause
  exit /b 1
)

echo Сайт будет доступен по адресу http://localhost:8080
echo Браузер откроется через несколько секунд. Чтобы остановить сервер, закройте это окно.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:8080"
npx --yes serve -l 8080 .
pause
