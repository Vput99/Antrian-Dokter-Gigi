@echo off
title Klinik Sehat - Server Antrian
echo Memulai Server Antrian Klinik Sehat...
cd /d "%~dp0"
start "" http://localhost:5000/admin.html
node server.js
