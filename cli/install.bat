@echo off
setlocal enabledelayedexpansion

echo 🏥 Installing Medical Claims Timeline CLI...

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 14+ first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

:: Get Node.js version
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("!NODE_VERSION!") do set MAJOR_VERSION=%%i

if !MAJOR_VERSION! lss 14 (
    echo ❌ Node.js version !NODE_VERSION! is not supported. Please upgrade to Node.js 14+.
    pause
    exit /b 1
)

echo ✅ Node.js version !NODE_VERSION! detected

:: Install globally
echo 📦 Installing medical-claims-timeline-cli globally...
npm install -g medical-claims-timeline-cli

if errorlevel 1 (
    echo ❌ Installation failed. Please check your permissions and try again.
    pause
    exit /b 1
)

echo ✅ Installation complete!
echo.
echo 🚀 You can now use the CLI with:
echo    claims-timeline --help
echo    mct --help
echo.
echo 📖 Quick start:
echo    claims-timeline generate your-data.json
echo    claims-timeline interactive
echo.
echo 📚 For more information:
echo    claims-timeline info
echo    https://github.com/medical-claims-timeline/cli

pause