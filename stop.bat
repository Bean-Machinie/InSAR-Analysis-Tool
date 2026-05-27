@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| find "127.0.0.1:5000"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo InSAR Viewer stopped.
