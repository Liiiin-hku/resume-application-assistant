@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 goto systemnode
set "TASK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%TASK_NODE%" goto missing
"%TASK_NODE%" scripts\workspace.mjs build
goto finished
:systemnode
node scripts\workspace.mjs build
goto finished
:missing
echo 未找到 Node.js。请安装 Node.js 22 或更新版本后重试。
echo 已交付的 dist\extension 可以直接加载，无需先构建。
pause
exit /b 1
:finished
if errorlevel 1 goto failed
echo.
echo 构建完成。在浏览器扩展管理页点击“重新加载”，不要卸载旧插件。
echo 加载目录：%CD%\dist\extension
pause
exit /b 0
:failed
echo.
echo 构建失败。请保留上方错误信息，交给 Codex 在此项目中修复。
pause
exit /b 1
