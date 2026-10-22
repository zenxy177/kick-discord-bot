@echo off
title Kick Discord Bot - Ilk Kurulum
color 0B
echo ===================================================
echo       KICK DISCORD BOT - OTOMATIK KURULUM
echo ===================================================
echo.
echo [1/3] Node.js bagimliliklari yukleniyor (npm install)...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] npm install basarisiz oldu. Lutfen Node.js (v20+) kurulu oldugundan emin olun!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Veritabani semasi hazirlaniyor...
call npx prisma generate
call npx prisma db push

echo.
echo [3/3] .env yapilandirma dosyasi kontrol ediliyor...
if not exist .env (
    if exist .env.example (
        copy .env.example .env
        echo [BILGI] .env dosyasi olusturuldu. Lutfen icine DISCORD_TOKEN bilginizi girin!
    )
)

echo.
echo ===================================================
echo   TEBRIKLER! Kurulum basariyla tamamlandi.
echo.
echo   1. ".env" dosyasini acip DISCORD_TOKEN bilginizi yazin.
echo   2. "2-botu-baslat.bat" dosyasina tiklayarak botunuzu calistirin!
echo ===================================================
pause
