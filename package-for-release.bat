@echo off
title 打包 Deepudio Radio
echo 正在打包...
echo.

set OUT=Deepudio-Radio-便携版.zip
set TEMP_DIR=Deepudio-Radio

:: 清理旧文件
if exist "%OUT%" del "%OUT%"
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"

:: 创建临时目录
mkdir "%TEMP_DIR%"

:: 复制文件（不包含 node_modules 和 .git）
xcopy "client" "%TEMP_DIR%\client\" /E /I /Q
xcopy "server" "%TEMP_DIR%\server\" /E /I /Q
xcopy "electron" "%TEMP_DIR%\electron\" /E /I /Q
copy "launch.mjs" "%TEMP_DIR%\" >nul
copy "launch.bat" "%TEMP_DIR%\" >nul
copy "package.json" "%TEMP_DIR%\" >nul
copy "package-lock.json" "%TEMP_DIR%\" >nul
copy "setup.bat" "%TEMP_DIR%\" >nul
copy ".npmrc" "%TEMP_DIR%\" >nul
copy ".gitignore" "%TEMP_DIR%\" >nul

:: 创建使用说明
echo Deepudio Radio - AI 智能点歌电台 > "%TEMP_DIR%\使用说明.txt"
echo. >> "%TEMP_DIR%\使用说明.txt"
echo 使用方法： >> "%TEMP_DIR%\使用说明.txt"
echo 1. 双击 setup.bat（首次运行，会自动安装） >> "%TEMP_DIR%\使用说明.txt"
echo 2. 以后双击 launch.bat 启动 >> "%TEMP_DIR%\使用说明.txt"
echo 3. 浏览器打开 http://localhost:8080 >> "%TEMP_DIR%\使用说明.txt"
echo 4. 设置页面填入 DeepSeek API Key >> "%TEMP_DIR%\使用说明.txt"
echo. >> "%TEMP_DIR%\使用说明.txt"
echo 需要 Node.js 环境，如果没装：https://nodejs.org >> "%TEMP_DIR%\使用说明.txt"

:: 压缩
powershell -Command "Compress-Archive -Path '%TEMP_DIR%' -DestinationPath '%OUT%' -Force"

:: 清理
rd /s /q "%TEMP_DIR%"

echo 打包完成：%OUT%
echo 发给对方后，解压双击 setup.bat 即可
pause
