@echo off
setlocal

set "FLUTTER=%USERPROFILE%\develop\flutter\bin\flutter.bat"
if not exist "%FLUTTER%" (
  echo No se encontro Flutter en %FLUTTER%
  echo Instala Flutter ahi o agrega flutter.bat al PATH.
  exit /b 1
)

pushd "%~dp0apps\flutter_consumer"
if /I "%~1"=="apk" (
  call "%FLUTTER%" build apk --debug
) else if /I "%~1"=="analyze" (
  call "%FLUTTER%" analyze
) else if /I "%~1"=="test" (
  call "%FLUTTER%" test --no-pub --reporter expanded
) else (
  call "%FLUTTER%" run
)
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%
