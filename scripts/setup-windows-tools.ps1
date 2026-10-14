# Developer-only provisioning; no board firmware is written.
param([switch]$InstallEsp32)
$ErrorActionPreference = 'Stop'
$toolRoot = 'D:\Software\EduBoard-Tools'
$cliRoot = Join-Path $toolRoot 'arduino-cli\1.5.1'
New-Item -ItemType Directory -Path $cliRoot -Force | Out-Null
$archive = Join-Path $cliRoot 'arduino-cli_1.5.1_Windows_64bit.zip'
$expectedHash = 'fabe42e0eb04d00e776a66178299ff95a46c623dbc260f997e58fd514853dd40'
if (!(Test-Path -LiteralPath $archive)) {
  Invoke-WebRequest -Uri 'https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_Windows_64bit.zip' -OutFile $archive
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash -ne $expectedHash) { throw 'Arduino CLI checksum mismatch.' }
if (!(Test-Path -LiteralPath (Join-Path $cliRoot 'arduino-cli.exe'))) {
  Expand-Archive -LiteralPath $archive -DestinationPath $cliRoot -Force
}
$binaryHash = '1017de89179c3167e6b8a38ca6cc4091fa69a3cf97aafa7810f01423003f5571'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $cliRoot 'arduino-cli.exe')).Hash -ne $binaryHash) {
  throw 'Existing Arduino CLI executable checksum mismatch. Close any running CLI, then re-extract the verified archive.'
}
$env:ARDUINO_CLI_PATH = Join-Path $cliRoot 'arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA = Join-Path $toolRoot 'arduino-data'
$env:ARDUINO_DIRECTORIES_DOWNLOADS = Join-Path $toolRoot 'arduino-downloads'
$env:ARDUINO_DIRECTORIES_USER = Join-Path $toolRoot 'arduino-user'
$env:ARDUINO_UPDATER_ENABLE_NOTIFICATION = 'false'
$configPath = Join-Path $toolRoot 'arduino-cli.yaml'
@'
directories:
  data: D:/Software/EduBoard-Tools/arduino-data
  downloads: D:/Software/EduBoard-Tools/arduino-downloads
  user: D:/Software/EduBoard-Tools/arduino-user
updater:
  enable_notification: false
'@ | Set-Content -LiteralPath $configPath -Encoding utf8
Write-Output "Arduino CLI verified at $env:ARDUINO_CLI_PATH"
Write-Output "Select this configuration in the IDE: $configPath"
if ($InstallEsp32) {
  & $env:ARDUINO_CLI_PATH core update-index --additional-urls 'https://espressif.github.io/arduino-esp32/package_esp32_index.json'
  if ($LASTEXITCODE -ne 0) { throw 'Index update failed.' }
  & $env:ARDUINO_CLI_PATH core install 'esp32:esp32@3.3.12' --additional-urls 'https://espressif.github.io/arduino-esp32/package_esp32_index.json'
  if ($LASTEXITCODE -ne 0) { throw 'ESP32 installation failed.' }
}
