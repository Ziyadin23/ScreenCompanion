$ErrorActionPreference = 'Stop'
$verify = Join-Path $PSScriptRoot 'verify-windows-zip.ps1'
$root = [IO.Directory]::CreateTempSubdirectory('sc-zip-test-').FullName
try {
    $desktop = Join-Path $root 'desktop'
    $dist = [IO.Directory]::CreateDirectory((Join-Path $desktop 'dist')).FullName
    $exeName = 'SC-v1.2.3.exe'
    $exePath = Join-Path $dist $exeName
    $readmePath = Join-Path $root 'README.md'
    $zipPath = Join-Path $dist 'SC-v1.2.3.zip'
    [IO.File]::WriteAllText((Join-Path $desktop 'package.json'), '{"version":"1.2.3"}')
    [IO.File]::WriteAllBytes($exePath, [byte[]](0, 128, 255))
    [IO.File]::WriteAllText($readmePath, "SC`r`n")

    function Write-FixtureZip([string[]]$Names, [switch]$DataDescriptor) {
        [IO.File]::Delete($zipPath)
        # ZipArchive writes data descriptors when the destination cannot seek.
        $pipe = if ($DataDescriptor) { [IO.Pipelines.Pipe]::new() }
        $zip = if ($DataDescriptor) {
            [IO.Compression.ZipArchive]::new($pipe.Writer.AsStream(), 'Create')
        } else {
            [IO.Compression.ZipFile]::Open($zipPath, 'Create')
        }
        try {
            foreach ($name in $Names) {
                $source = if ($name -ceq $exeName) { $exePath } else { $readmePath }
                [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $source, $name)
            }
        } finally {
            $zip.Dispose()
        }
        if ($DataDescriptor) {
            $reader = $pipe.Reader.AsStream()
            $file = [IO.File]::Create($zipPath)
            try { $reader.CopyTo($file) } finally { $file.Dispose(); $reader.Dispose() }
        }
    }

    function Assert-Rejected([string]$ExpectedError, [string]$Fixture = $ExpectedError) {
        try {
            & $verify $desktop
        } catch {
            if ($_.Exception.Message -cne $ExpectedError) { throw }
            return
        }
        throw "Verifier accepted an invalid fixture ($Fixture)."
    }

    Write-FixtureZip @($exeName, 'README.txt')
    $original = [IO.File]::ReadAllBytes($zipPath)
    if (([BitConverter]::ToUInt16($original, 6) -band 8) -ne 0) {
        throw 'Expected local CRC and sizes in the seekable ZIP fixture.'
    }
    & $verify $desktop
    # Change one local field at a time. The directory and payload stay intact.
    $fields = [ordered]@{ CRC = 14; CompressedSize = 18; UncompressedSize = 22; Method = 8 }
    foreach ($field in $fields.GetEnumerator()) {
        $offset = $field.Value
        $bytes = $original.Clone()
        $bytes[$offset] = $bytes[$offset] -bxor 1
        [IO.File]::WriteAllBytes($zipPath, $bytes)
        Assert-Rejected "ZIP local header disagrees for $exeName." "local EXE $($field.Key)"
    }

    Write-FixtureZip @('README.txt', $exeName)
    [IO.File]::WriteAllBytes($exePath, [byte[]](0, 129, 255))
    Assert-Rejected "ZIP bytes differ for $exeName."
    [IO.File]::WriteAllBytes($exePath, [byte[]](0, 128, 255))
    [IO.File]::WriteAllText($readmePath, "Sc`r`n")
    Assert-Rejected 'ZIP bytes differ for README.txt.'

    Write-FixtureZip @($exeName, 'README.txt', 'extra.txt')
    Assert-Rejected 'Expected exactly two ZIP entries.'
    Write-FixtureZip @($exeName)
    Assert-Rejected 'Expected exactly two ZIP entries.'
    foreach ($unexpected in @($exeName, 'nested/README.txt', 'readme.txt')) {
        Write-FixtureZip @($exeName, $unexpected)
        Assert-Rejected 'Unexpected or duplicate ZIP entry.'
    }
    Write-FixtureZip @('README.txt', $exeName)
    $bytes = [IO.File]::ReadAllBytes($zipPath)
    # The first local file name starts immediately after the 30-byte ZIP header.
    $nameOffset = 30
    if ([Text.Encoding]::ASCII.GetString($bytes, $nameOffset, 10) -cne 'README.txt') {
        throw 'Expected README.txt in the first local header of the fixture.'
    }
    $bytes[$nameOffset] = $bytes[$nameOffset] -bxor 1
    [IO.File]::WriteAllBytes($zipPath, $bytes)
    Assert-Rejected 'ZIP local header disagrees for README.txt.'

    Write-FixtureZip @($exeName, 'README.txt') -DataDescriptor
    $original = [IO.File]::ReadAllBytes($zipPath)
    if (([BitConverter]::ToUInt16($original, 6) -band 8) -eq 0) {
        throw 'Expected a data descriptor in the non-seekable ZIP fixture.'
    }
    & $verify $desktop
    # The first descriptor follows the compressed EXE. Read its size from the directory.
    $directory = [BitConverter]::ToUInt32($original, $original.Length - 6)
    $data = 30 + [BitConverter]::ToUInt16($original, 26) + [BitConverter]::ToUInt16($original, 28)
    $descriptor = $data + [BitConverter]::ToUInt32($original, $directory + 20)
    if ([BitConverter]::ToUInt32($original, $descriptor) -ne 0x08074b50) {
        throw 'Expected a signed EXE data descriptor.'
    }
    foreach ($offset in @(4, 8, 12)) { # CRC, compressed size, original size
        $bytes = $original.Clone()
        $bytes[$descriptor + $offset] = $bytes[$descriptor + $offset] -bxor 1
        [IO.File]::WriteAllBytes($zipPath, $bytes)
        Assert-Rejected "ZIP data descriptor disagrees for $exeName."
    }
    # Remove only the optional signature from the last descriptor and move the directory back four bytes.
    $lastDescriptor = $directory - 16
    if ([BitConverter]::ToUInt32($original, $lastDescriptor) -ne 0x08074b50) {
        throw 'Expected a signed README data descriptor.'
    }
    $unsigned = [byte[]]::new($original.Length - 4)
    [Array]::Copy($original, 0, $unsigned, 0, $lastDescriptor)
    [Array]::Copy($original, $lastDescriptor + 4, $unsigned, $lastDescriptor, $original.Length - $lastDescriptor - 4)
    [BitConverter]::GetBytes([uint32]($directory - 4)).CopyTo($unsigned, $unsigned.Length - 6)
    [IO.File]::WriteAllBytes($zipPath, $unsigned)
    & $verify $desktop

    $stagedReadme = Join-Path $root 'README.txt'
    Copy-Item -LiteralPath $readmePath -Destination $stagedReadme
    Compress-Archive -LiteralPath @($exePath, $stagedReadme) -DestinationPath $zipPath -Force
    & $verify $desktop
    Write-Output 'Passed all 19 portable ZIP fixtures.'
} finally {
    [IO.Directory]::Delete($root, $true)
}
