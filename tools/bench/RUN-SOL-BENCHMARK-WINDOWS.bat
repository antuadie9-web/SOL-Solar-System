@echo off
REM SOL v3.8.1 — one-click hardware benchmark for Windows (PERF-381-01).
REM Needs: Node.js 20 or newer (https://nodejs.org, "LTS" installer) and Google Chrome.
REM Double-click this file from the SOL folder. First run installs dependencies and builds (a few minutes).
setlocal
cd /d "%~dp0\..\.."
where node >nul 2>nul || (echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules (echo Installing dependencies... & call npm ci || (echo npm ci failed & pause & exit /b 1))
if not exist dist\index.html (echo Building SOL... & call npm run build || (echo build failed & pause & exit /b 1))
echo Starting the local server on http://localhost:4173/ ...
start "SOL server" cmd /c "npm run preview -- --port 4173 --strictPort"
timeout /t 4 >nul
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% (start "" %CHROME% --new-window "http://localhost:4173/?bench=1") else (start "" "http://localhost:4173/?bench=1")
echo.
echo The benchmark runs by itself for about 3 minutes. Do not touch the mouse or keyboard.
echo When it finishes, Chrome downloads a file named sol-benchmark-....json — please send that file back.
echo Close the "SOL server" window when you are done.
pause
