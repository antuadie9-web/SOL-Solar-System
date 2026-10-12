@echo off
REM SOL v3.8.1 hardware benchmark launcher (PERF-381-01). No installation, no administrator rights, no uploads.
REM It serves the bundled, pre-built app from this folder on http://localhost:4173 (your own PC only) and opens Chrome.
setlocal
cd /d "%~dp0\..\.."
if not exist dist\index.html (echo This package does not contain the built app ^(dist^). & pause & exit /b 1)
where node >nul 2>nul
if %errorlevel%==0 (start "SOL local server - close to stop" node tools\bench\serve.mjs dist) else (start "SOL local server - close to stop" powershell -NoProfile -ExecutionPolicy Bypass -File tools\bench\serve.ps1)
timeout /t 3 >nul
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist %CHROME% (start "" %CHROME% --new-window "http://localhost:4173/?bench=1") else (start "" "http://localhost:4173/?bench=1")
echo.
echo The benchmark runs by itself for about 3 minutes. Please do not touch the mouse or keyboard.
echo When it finishes Chrome saves sol-benchmark-....json in your Downloads folder. Nothing is uploaded.
echo Close the "SOL local server" window when you are done.
pause
