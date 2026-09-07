@echo off
setlocal
set "COSMO_ROOT=%~dp0"
set "COSMO_ENGINE=%COSMO_ROOT%work\godot-runtime\Godot_v4.7.2-stable_win64.exe"
if not exist "%COSMO_ENGINE%" (
  echo The portable Godot engine was not found under work\godot-runtime.
  echo Open native-godot\project.godot in Godot 4.7.2 and press F6 or F5.
  pause
  exit /b 1
)
start "Cosmo" "%COSMO_ENGINE%" --path "%COSMO_ROOT%native-godot"
