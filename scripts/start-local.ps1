$ErrorActionPreference = 'Stop'
$env:ARDUINO_CLI_PATH = 'D:\Software\EduBoard-Tools\arduino-cli\1.5.1\arduino-cli.exe'
$env:ARDUINO_CLI_CONFIG_FILE = 'D:\Software\EduBoard-Tools\arduino-cli.yaml'
$env:electron_config_cache = 'D:\Software\EduBoard-Tools\electron-cache'
$env:npm_config_cache = 'D:\Software\EduBoard-Tools\npm-cache'
$env:ELECTRON_BUILDER_CACHE = 'D:\Software\EduBoard-Tools\builder-cache'
npm run dev
