@echo off
title Deepudio Radio

echo.
echo   Deepudio Radio
echo   AI
echo.

:: 先构建前端
echo [1/2] Building...
call npm run build --workspace=client --silent

:: 启动
echo [2/2] Launching...
node launch.mjs
