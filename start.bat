@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node >nul 2>&1
if errorlevel 1 goto missing_node
set "VN_LAUNCH_PORT=%~1"
if not defined VN_LAUNCH_PORT set /p "VN_LAUNCH_PORT=Port [5175] (press Enter for default): "
node scripts/start.mjs
set "VN_LAUNCH_RESULT=%ERRORLEVEL%"
popd
if not "%VN_LAUNCH_RESULT%"=="0" pause
exit /b %VN_LAUNCH_RESULT%
:missing_node
echo Node.js was not found. Install Node.js 22.12 or later.
popd
pause
exit /b 1
