@echo off
rem Start the memo app: run a local web server on port 5000 and open the browser.
rem Close this black window to stop the server.
cd /d "%~dp0"
echo ================================================
echo   Memo app is starting...  http://localhost:5000
echo   Keep this window open while you use the app.
echo   Close this window to stop.
echo ================================================
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:5000"
python -m http.server 5000 --bind 127.0.0.1
echo.
echo The server stopped. If you saw an error above, the app may already be running
echo (check http://localhost:5000) or Python is not installed.
pause
