$ErrorActionPreference = "Stop"
$project = [xml](Get-Content .\SC.csproj)
$version = $project.Project.PropertyGroup.Version

dotnet publish .\SC.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output .\publish\win-x64
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

$versionedExe = "SC-v$version.exe"
Move-Item -Force .\publish\win-x64\SC.exe ".\publish\win-x64\$versionedExe"
Copy-Item -Force .\README.md .\publish\win-x64\README.txt
Write-Host "Ready: .\publish\win-x64\$versionedExe"
Write-Host "Guide: .\publish\win-x64\README.txt"
