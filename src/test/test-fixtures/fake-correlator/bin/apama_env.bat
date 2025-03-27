@echo off
REM Mock apama_env.bat script for testing
REM This script is used to execute Apama commands
REM It simply passes the command to the actual executable

if "%1"=="" (
  echo Usage: apama_env.bat ^<command^> [args...]
  exit /b 1
)

set COMMAND=%1
shift

REM Execute the command directly from the bin directory
"%~dp0%COMMAND%" %*