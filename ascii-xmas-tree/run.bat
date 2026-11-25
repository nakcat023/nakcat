@echo off
rem Double-click this file to open the ASCII Christmas tree.
rem (No Thai text in here: cmd.exe misreads Thai characters in .bat files.)
cd /d "%~dp0"

rem First run on a new machine: create .venv and install numpy + pygame.
if not exist ".venv\Scripts\pythonw.exe" (
    echo Installing Python and packages, first time only. Please wait...
    uv venv --python 3.12 .venv || goto fail
    uv pip install --python .venv -r requirements.txt || goto fail
)

start "" ".venv\Scripts\pythonw.exe" xmas_tree.py
exit /b

:fail
echo Install failed. This machine may not have uv: https://docs.astral.sh/uv/
pause
