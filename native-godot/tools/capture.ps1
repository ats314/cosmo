# Capture real frames from the native build.
#
# The project rule is that a visual change is inspected in a real frame, not
# asserted. A shader can compile, pass every headless check, and still render a
# grey rectangle — headless checks never look at the screen, so this is the only
# thing that actually catches it.
#
# It drives the game through main.gd's own test arguments, which use the same
# controls a player does. --autoplay is a driver, not an invulnerability or
# scoring bypass, so a frame captured here is a frame the game really produced.
#
#   pwsh native-godot/tools/capture.ps1                    menu + all six levels
#   pwsh native-godot/tools/capture.ps1 -Levels 1,4        just those levels
#   pwsh native-godot/tools/capture.ps1 -Seconds 40        deeper into the run
#   pwsh native-godot/tools/capture.ps1 -Tag before        label the set
#
# Frames land in work/captures/<tag>/ and work/ is not committed.
#
# RUN THIS SERIALLY. Concurrent Godot processes on one project corrupt the
# shared .godot import cache, so do not background several of these at once.
param(
    # Taken as a string and split here on purpose. Invoked through
    # `powershell -File`, arguments arrive as plain strings and never bind to
    # [int[]] — `-Levels 1,3,5` arrives as the single token "1,3,5" and silently
    # became one capture named "level135". Splitting makes both `-Levels 1,3,5`
    # and `-Levels 4` behave the same way from -File and from a dot-source.
    [string]$Levels = '1,2,3,4,5,6',
    [int]$Seconds = 25,
    [string]$Tag = 'current',
    [switch]$SkipMenu,
    [string]$Godot = ''
)
$ErrorActionPreference = 'Stop'

$nativeProject = Split-Path $PSScriptRoot -Parent
$cosmoRoot = Split-Path $nativeProject -Parent
if (-not $Godot) {
    $Godot = Join-Path $cosmoRoot 'work\godot-runtime\Godot_v4.7.2-stable_win64_console.exe'
}
if (-not (Test-Path -LiteralPath $Godot -PathType Leaf)) {
    throw "Godot 4.7.2 console executable not found at $Godot. Pass -Godot with its path."
}

$outDir = Join-Path $cosmoRoot "work\captures\$Tag"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

# A shader that fails to compile prints to stderr and still produces a frame —
# a black or magenta one. Collect that output per shot so a broken capture is
# reported as broken rather than quietly saved and eyeballed later.
$results = @()

function Invoke-Capture {
    param([string]$Name, [string[]]$GameArgs, [int]$TimeoutSeconds)

    $png = Join-Path $outDir "$Name.png"
    if (Test-Path -LiteralPath $png) { Remove-Item -LiteralPath $png -Force }

    # ORDER MATTERS AND IT IS NOT OBVIOUS. main.gd parses these left to right:
    # `--capture=` sets capture_time to its own 2s default, while `--seconds=`
    # sets capture_time to the run length only when a capture path is already
    # known. Appending --capture last therefore silently clamps every shot to
    # two seconds, which photographs the level card instead of the game — the
    # first run of this script captured seven frames of the opening title at
    # score 0003 and they looked plausible enough to nearly pass review.
    $all = @('--path', $nativeProject, '--resolution', '540x960', '--', "--capture=$png") + $GameArgs
    Write-Host "  $Name ... " -NoNewline

    $stdout = Join-Path $outDir "$Name.log"
    $proc = Start-Process -FilePath $Godot -ArgumentList $all -NoNewWindow -PassThru `
        -RedirectStandardOutput $stdout -RedirectStandardError "$stdout.err"
    if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
        $proc.Kill()
        Write-Host 'TIMED OUT'
        return [pscustomobject]@{ Name = $Name; Ok = $false; Note = 'timed out' }
    }

    $log = ''
    if (Test-Path -LiteralPath $stdout) { $log = Get-Content -LiteralPath $stdout -Raw }
    $err = ''
    if (Test-Path -LiteralPath "$stdout.err") { $err = Get-Content -LiteralPath "$stdout.err" -Raw }

    # Godot reports shader compile failures on stderr without failing the run.
    $shaderTrouble = ($err -match '(?im)^.*(shader|SHADER).*(error|failed)') -or ($log -match 'Shader compilation failed')
    $captured = Test-Path -LiteralPath $png

    if (-not $captured) {
        Write-Host 'NO FRAME'
        return [pscustomobject]@{ Name = $Name; Ok = $false; Note = 'no PNG written' }
    }
    $size = (Get-Item -LiteralPath $png).Length
    if ($shaderTrouble) {
        Write-Host "shader errors ($([math]::Round($size/1KB))KB)"
        return [pscustomobject]@{ Name = $Name; Ok = $false; Note = 'shader compile errors — see the .log.err' }
    }
    # A frame that compressed to almost nothing is a flat fill: black screen,
    # missing sky, or a shader that returned a constant.
    if ($size -lt 12KB) {
        Write-Host "suspiciously flat ($([math]::Round($size/1KB))KB)"
        return [pscustomobject]@{ Name = $Name; Ok = $false; Note = 'frame is nearly uniform — probably rendering nothing' }
    }
    Write-Host "ok ($([math]::Round($size/1KB))KB)"
    return [pscustomobject]@{ Name = $Name; Ok = $true; Note = '' }
}

Write-Host "Capturing '$Tag' into $outDir"

if (-not $SkipMenu) {
    $results += Invoke-Capture -Name 'menu' -GameArgs @() -TimeoutSeconds 60
}
$levelList = @($Levels -split '[,\s]+' | Where-Object { $_ -ne '' } | ForEach-Object { [int]$_ })
if ($levelList.Count -eq 0) { throw "No levels parsed from -Levels '$Levels'." }
foreach ($level in $levelList) {
    $results += Invoke-Capture -Name "level$level" `
        -GameArgs @("--play=$level", '--autoplay', "--seconds=$Seconds") `
        -TimeoutSeconds ($Seconds + 45)
}

$bad = @($results | Where-Object { -not $_.Ok })
Write-Host ''
if ($bad.Count -gt 0) {
    foreach ($b in $bad) { Write-Host "FAIL  $($b.Name): $($b.Note)" }
    throw "$($bad.Count) of $($results.Count) captures failed. Frames in $outDir"
}
Write-Host "OK  $($results.Count) frames in $outDir"
