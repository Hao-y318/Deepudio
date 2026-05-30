@echo off
title Deepudio Radio 首次安装
echo.
echo   Deepudio Radio - AI 智能点歌电台
echo   首次运行，正在安装依赖（需要 2-5 分钟）...
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到 Node.js，请先安装：https://nodejs.org
    echo 下载 LTS 版本，安装后重新运行本脚本
    pause
    exit /b 1
)

:: 安装依赖
call npm install
if %errorlevel% neq 0 (
    echo 安装失败，请检查网络
    pause
    exit /b 1
)

echo.
echo 安装完成！现在启动...
echo.
call npm start
pause
