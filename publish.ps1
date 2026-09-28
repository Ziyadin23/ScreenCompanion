$ErrorActionPreference = "Stop"
$project = [xml](Get-Content .\ScreenCompanion.csproj)
$version = $project.Project.PropertyGroup.Version

dotnet publish .\ScreenCompanion.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output .\publish\win-x64
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

$versionedExe = "ScreenCompanion-v$version.exe"
Move-Item -Force .\publish\win-x64\ScreenCompanion.exe ".\publish\win-x64\$versionedExe"
Write-Host "Ready: .\publish\win-x64\$versionedExe"
