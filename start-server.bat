@echo off
title Esfand Games Server
cd /d "%~dp0"
echo Starting Esfand Games server on http://localhost:8080 ...
node server.mjs
pause
