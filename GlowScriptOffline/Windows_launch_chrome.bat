@echo off
set scriptpath=%~dp0
set siblingfile=GlowScript.html
call:MakeAbsolute siblingfile      "%scriptpath%"

start chrome.exe --disable-web-security --user-data-dir %siblingfile%
GOTO:EOF

:: from https://stackoverflow.com/questions/1645843/
:: resolve-absolute-path-from-relative-path-and-or-file-
:: name?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa

::----------------------------------------------------------------------------------
:: Function declarations
:: Handy to read http://www.dostips.com/DtTutoFunctions.php for how dos functions
:: work.
::----------------------------------------------------------------------------------
:MakeAbsolute file base -- makes a file name absolute considering a base path
::                      -- file [in,out] - variable with file name to be converted, or file name itself for result in stdout
::                      -- base [in,opt] - base path, leave blank for current directory
:$created 20060101 :$changed 20080219 :$categories Path
:$source http://www.dostips.com
SETLOCAL ENABLEDELAYEDEXPANSION
set "src=%~1"
if defined %1 set "src=!%~1!"
set "bas=%~2"
if not defined bas set "bas=%cd%"
for /f "tokens=*" %%a in ("%bas%.\%src%") do set "src=%%~fa"
( ENDLOCAL & REM RETURN VALUES
    IF defined %1 (SET %~1=%src%) ELSE ECHO.%src%
)
EXIT /b