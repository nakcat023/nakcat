@echo off
rem Double-click this file to open the ASCII Christmas tree.
rem (No Thai text in here: cmd.exe misreads Thai characters in .bat files.)
cd /d "%~dp0"

rem First run on a new machine: create .venv and install numpy + pygame-ce.
rem Uses uv if this machine has it, otherwise the normal Python (py or python).
if not exist ".venv\Scripts\pythonw.exe" (
    echo Installing packages, first time only. Please wait...
    where uv >nul 2>nul
    if not errorlevel 1 (
        uv venv --python 3.12 .venv || goto fail
        uv pip install --python .venv -r requirements.txt || goto fail
    ) else (
        where py >nul 2>nul
        if not errorlevel 1 (
            py -3 -m venv .venv || goto fail
        ) else (
            python -m venv .venv || goto fail
        )
        ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto fail
    )
)

start "" ".venv\Scripts\pythonw.exe" xmas_tree.py
exit /b

:fail
echo Install failed. Install Python from https://www.python.org/downloads/ and try again.
rem Remove the half-made .venv so the next try starts clean.
if exist ".venv" rmdir /s /q ".venv"
pause
