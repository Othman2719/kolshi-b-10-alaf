@echo off
title Hanout Kolshi b 10 Alaf
echo ========================================================
echo   Demarrage de l'Application Hanout 10 Alaf (100 DA)
echo ========================================================
echo.
echo Ouverture du serveur local...
start http://localhost:5173
npm run dev -- --host 0.0.0.0 --port 5173
pause
