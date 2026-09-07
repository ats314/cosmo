param([string]$Godot = '')
$ErrorActionPreference = 'Stop'
$nativeProject = Split-Path $PSScriptRoot -Parent
$cosmoRoot = Split-Path $nativeProject -Parent
if (-not $Godot) {
    $Godot = Join-Path $cosmoRoot 'work\godot-runtime\Godot_v4.7.2-stable_win64_console.exe'
}
if (-not (Test-Path -LiteralPath $Godot -PathType Leaf)) {
    throw 'Pass -Godot with the path to the Godot 4.7.2 console executable.'
}
$testOutput = Join-Path $cosmoRoot 'work\native-checks'
New-Item -ItemType Directory -Path $testOutput -Force | Out-Null
$priorAppData = $env:APPDATA
$priorLocalAppData = $env:LOCALAPPDATA
try {
    $env:APPDATA = $testOutput
    $env:LOCALAPPDATA = $testOutput
    foreach ($testName in @('fidelity_check', 'profile_check', 'tidal_check', 'host_check', 'overdrive_check')) {
        & $Godot --headless --path $nativeProject --log-file (Join-Path $testOutput "$testName.log") --script "res://tests/$testName.gd"
        if ($LASTEXITCODE -ne 0) { throw "$testName failed with exit code $LASTEXITCODE" }
    }
    Write-Output 'All five native checks passed.'
} finally {
    $env:APPDATA = $priorAppData
    $env:LOCALAPPDATA = $priorLocalAppData
}
