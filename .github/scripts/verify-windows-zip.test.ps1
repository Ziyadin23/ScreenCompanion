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

    function Write-FixtureZip([string[]]$Names) {
        [IO.File]::Delete($zipPath)
        $zip = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
        try {
            foreach ($name in $Names) {
                $source = if ($name -ceq $exeName) { $exePath } else { $readmePath }
                [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $source, $name)
            }
        } finally {
            $zip.Dispose()
        }
    }

    function Assert-Rejected([string]$ExpectedError) {
        try {
            & $verify $desktop
        } catch {
            if ($_.Exception.Message -cne $ExpectedError) { throw }
            return
        }
        throw "Verifier accepted a fixture that should fail with '$ExpectedError'."
    }

    Write-FixtureZip @('README.txt', $exeName)
    & $verify $desktop
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
        Assert-Rejected 'ZIP is missing README.txt.'
    }
    Write-Output 'Passed all eight portable ZIP fixtures.'
} finally {
    [IO.Directory]::Delete($root, $true)
}
