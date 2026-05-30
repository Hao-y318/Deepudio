@echo off
title 打包 Deepudio Radio
echo 正在准备打包...
echo.

set OUT=Deepudio-Radio-便携版.zip
set TEMP_DIR=Deepudio-Radio
set NODE_URL=https://npmmirror.com/mirrors/node/v22.12.0/node-v22.12.0-win-x64.zip
set NODE_ZIP=node-portable.zip

:: 清理旧文件
if exist "%OUT%" del "%OUT%"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
if exist "%NODE_ZIP%" del "%NODE_ZIP%"

:: 下载便携版 Node.js（如果还没下载）
if not exist "node-v22.12.0-win-x64" (
    echo [1/4] 下载 Node.js 便携版（约30MB）...
    powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
    powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '.' -Force"
    del "%NODE_ZIP%"
) else (
    echo [1/4] Node.js 便携版已存在，跳过下载
)

:: 创建目录结构
echo [2/4] 复制项目文件...
mkdir "%TEMP_DIR%"
xcopy "client" "%TEMP_DIR%\client\" /E /I /Q
xcopy "server" "%TEMP_DIR%\server\" /E /I /Q
xcopy "electron" "%TEMP_DIR%\electron\" /E /I /Q
xcopy "node-v22.12.0-win-x64" "%TEMP_DIR%\node\" /E /I /Q
copy "launch.mjs" "%TEMP_DIR%\" >nul
copy "launch.bat" "%TEMP_DIR%\" >nul
copy "package.json" "%TEMP_DIR%\" >nul
copy "package-lock.json" "%TEMP_DIR%\" >nul
copy ".npmrc" "%TEMP_DIR%\" >nul

:: 创建 setup.bat（使用内置 Node.js）
echo [3/4] 生成启动脚本...
(
echo @echo off
echo title Deepudio Radio
echo.
echo   Deepudio Radio - AI 智能点歌电台
echo.
echo :: 设置 PATH 为内置 Node.js
echo set "PATH=%%~dp0node;%%PATH%%"
echo.
echo :: 首次运行自动安装依赖
echo if not exist "node_modules" ^(
echo     echo 首次运行，正在安装依赖（约2-5分钟）...
echo     call npm install
echo     if %%errorlevel%% neq 0 ^(
echo         echo 安装失败，请检查网络后重试
echo         pause
echo         exit /b 1
echo     ^)
echo ^)
echo.
echo :: 启动
echo call npm start
echo pause
) > "%TEMP_DIR%\一键启动.bat"

:: 使用说明
echo Deepudio Radio - AI 智能点歌电台 > "%TEMP_DIR%\使用说明.txt"
echo. >> "%TEMP_DIR%\使用说明.txt"
echo 使用方法： >> "%TEMP_DIR%\使用说明.txt"
echo 1. 解压后双击「一键启动.bat」 >> "%TEMP_DIR%\使用说明.txt"
echo 2. 浏览器打开 http://localhost:8080 >> "%TEMP_DIR%\使用说明.txt"
echo 3. 设置页面填入 DeepSeek API Key 即可使用 >> "%TEMP_DIR%\使用说明.txt"

:: 压缩
echo [4/4] 压缩打包...
powershell -Command "Compress-Archive -Path '%TEMP_DIR%' -DestinationPath '%OUT%' -Force"
rd /s /q "%TEMP_DIR%"

echo.
echo 打包完成：%OUT%
echo 发给对方解压双击「一键启动.bat」即可
pause
