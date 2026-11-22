param([string]$DesktopRoot = (Join-Path $PSScriptRoot '../../desktop'))

$ErrorActionPreference = 'Stop'
$version = (Get-Content -Raw -LiteralPath (Join-Path $DesktopRoot 'package.json') | ConvertFrom-Json).version
$exeName = "SC-v$version.exe"
$sources = @{
    $exeName = Join-Path $DesktopRoot "dist/$exeName"
    'README.txt' = Join-Path $DesktopRoot '../README.md'
}

$zipPath = (Get-Item -LiteralPath (Join-Path $DesktopRoot "dist/SC-v$version.zip")).FullName
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    if ($zip.Entries.Count -ne $sources.Count) { throw 'Expected exactly two ZIP entries.' }
    foreach ($name in $sources.Keys) {
        $entry = $zip.GetEntry($name)
        if ($null -eq $entry) { throw "ZIP is missing $name." }
        $stream = $entry.Open()
        try {
            $archived = Get-FileHash -Algorithm SHA256 -InputStream $stream
            $source = Get-FileHash -Algorithm SHA256 -LiteralPath $sources[$name]
            if ($archived.Hash -ne $source.Hash) { throw "ZIP bytes differ for $name." }
        } finally {
            $stream.Dispose()
        }
    }
    # ZipArchive uses central directory names. Check local names and CRCs with the native build's Python.
    $testZip = @'
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1]) as archive:
    sys.exit(archive.testzip() is not None)
'@
    $PSNativeCommandUseErrorActionPreference = $false
    python -I -c $testZip $zipPath
    if ($LASTEXITCODE -ne 0) { throw 'Portable ZIP integrity check failed.' }
} finally {
    $zip.Dispose()
}
Write-Output "Verified $exeName and README.txt against the build inputs."
