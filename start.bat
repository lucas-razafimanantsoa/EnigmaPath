@echo off
rem Starts the EnigmaPath server (needed for the exam) and opens the browser.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py %*
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py %*
  goto :end
)
echo Python 3 is not installed. Install it from https://www.python.org/downloads/ and try again.
:end
pause
