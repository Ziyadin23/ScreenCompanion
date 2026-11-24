param([string]$DesktopRoot = (Join-Path $PSScriptRoot '../../desktop'))

$ErrorActionPreference = 'Stop'
$version = (Get-Content -Raw -LiteralPath (Join-Path $DesktopRoot 'package.json') | ConvertFrom-Json).version
$exeName = "SC-v$version.exe"
$zipPath = Join-Path $DesktopRoot "dist/SC-v$version.zip"
$exeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $DesktopRoot "dist/$exeName")).Hash.ToLowerInvariant()
$readmeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $DesktopRoot '../README.md')).Hash.ToLowerInvariant()
$validator = Join-Path $PSScriptRoot 'verify-windows-zip.mjs'
$PSNativeCommandUseErrorActionPreference = $false
$message = & node $validator $zipPath $exeName $exeHash $readmeHash 2>&1
if ($LASTEXITCODE -ne 0) { throw ($message -join [Environment]::NewLine) }
Write-Output "Verified $exeName and README.txt against the build inputs."
