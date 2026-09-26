$ErrorActionPreference = "Stop"

dotnet publish .\ScreenCompanion.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output .\publish\win-x64

Write-Host "Copy ScreenCompanion.exe from .\publish\win-x64 to the USB drive."
