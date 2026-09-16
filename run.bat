@echo off
title Spotify KW - Ultra-Lightweight Edition
cd /d "%~dp0"

echo =========================================================
echo    Spotify KW - Ultra-Lightweight Desktop Player
echo    Penggunaan RAM: ^< 70MB ^| Penyimpanan: ^< 5MB
echo =========================================================
echo.

:: 1. Cek apakah Python atau uv ada di sistem
set "PY_CMD="
where uv >nul 2>nul
if %errorlevel% equ 0 (
    set "USE_UV=1"
) else (
    set "USE_UV=0"
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PY_CMD=py"
    )
)

:: 2. Cek apakah .venv yang ada valid di komputer ini (mencegah error saat zip dipindah ke PC lain)
set "VENV_VALID=0"
if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe -c "import sys" >nul 2>nul
    if %errorlevel% equ 0 (
        set "VENV_VALID=1"
    ) else (
        echo [INFO] Menyesuaikan virtual environment untuk komputer ini...
        rmdir /s /q .venv >nul 2>nul
    )
)

:: 3. Jika .venv belum ada atau tidak valid, buat baru otomatis
if "%VENV_VALID%"=="0" (
    if "%PY_CMD%"=="" if "%USE_UV%"=="0" (
        echo [ERROR] Python tidak ditemukan di komputer ini!
        echo.
        echo Agar Spotify KW dapat berjalan, silakan install Python terlebih dahulu:
        echo 1. Kunjungi: https://www.python.org/downloads/
        echo 2. Download dan jalankan installer Python ^(versi 3.9 s/d terbaru^).
        echo 3. PENTING: Centang kotak "Add Python to PATH" di bagian bawah installer!
        echo 4. Setelah selesai, jalankan kembali run.bat ini.
        echo.
        pause
        exit /b 1
    )

    echo [1/2] Menyiapkan modul aplikasi (hanya butuh sekali di awal)...
    if "%USE_UV%"=="1" (
        uv venv .venv
        uv pip install -r requirements.txt
    ) else (
        %PY_CMD% -m venv .venv
        .venv\Scripts\python.exe -m pip install -r requirements.txt
    )
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Gagal menginstall modul aplikasi! Pastikan koneksi internet aktif.
        pause
        exit /b 1
    )
)

echo [2/2] Memulai server dan membuka aplikasi Spotify KW...
start "" .venv\Scripts\python.exe main.py

echo.
echo Aplikasi Spotify KW berhasil dijalankan!
echo Jendela pemutar musik akan segera terbuka otomatis.
echo.
timeout /t 3 >nul
exit
