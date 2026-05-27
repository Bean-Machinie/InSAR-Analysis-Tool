@echo off
cd /d "%~dp0insar-local-viewer"

if not exist ".venv\Scripts\python.exe" (
    echo Setting up virtual environment...
    py -3 -m venv .venv
    call ".venv\Scripts\activate.bat"
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r requirements.txt
) else (
    call ".venv\Scripts\activate.bat"
)

echo Starting InSAR Viewer...
start "" "http://127.0.0.1:5000"
python app\main.py
