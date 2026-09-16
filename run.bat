@echo off
title Spotify KW - Ultra-Lightweight Edition
cd /d "%~dp0"

echo =========================================================
echo    Spotify KW - Ultra-Lightweight Desktop Player
echo    Penggunaan RAM: ^< 70MB ^| Penyimpanan: ^< 5MB
echo =========================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [1/2] Menyiapkan lingkungan Python virtualenv...
    where uv >nul 2>nul
    if %errorlevel% equ 0 (
        uv venv .venv
        uv pip install -r requirements.txt
    ) else (
        python -m venv .venv
        .venv\Scripts\pip install -r requirements.txt
    )
)

echo [2/2] Memulai server dan membuka antarmuka Spotify KW...
start "" .venv\Scripts\python.exe main.py

echo.
echo Aplikasi berjalan di latar belakang!
echo Untuk menutup, silakan tutup jendela aplikasi Spotify KW.
exit
