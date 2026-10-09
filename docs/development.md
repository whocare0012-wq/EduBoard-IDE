# Developer setup / 开发环境

The following instructions target **Windows 10/11** and Node.js **22 or later**.

## Install and run
1. Install Node.js and Git.
2. Install [Arduino CLI](https://arduino.github.io/arduino-cli/latest/installation/) separately.
3. Clone this repository.
4. Run `npm install` and `npm run dev`.
5. Run `npm run typecheck` and `npm run build` before submitting a pull request.

Arduino CLI must be discoverable as `arduino-cli` on PATH. Alternatively, set `ARDUINO_CLI_PATH` to the absolute executable path before starting the development process.

## ESP32 setup

Install the official ESP32 board package with Arduino CLI (requires network access the first time):

```bash
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli board list
```

The generic ESP32 dev board commonly uses FQBN `esp32:esp32:esp32`, but select the actual model for your device. ESP32 board drivers and wiring vary.

## Hardware test checklist (not yet completed)
- [ ] Detect a connected device and its COM port
- [ ] Save Blink as `Blink/Blink.ino`
- [ ] Compile against an installed matching ESP32 core
- [ ] Upload to a real board
- [ ] Open serial monitor at the appropriate baud rate
- [ ] Stop monitoring, then upload again successfully
- [ ] Repeat on a freshly installed Windows machine

## Building and packaging
`npm run build` creates development build output, **not** a signed Windows installer. An installer and a lockfile will be added before first official release. Dependency updates must be reviewed and pinned in a committed lockfile before claiming reproducible builds.

## Troubleshooting
- `ENOENT` or CLI not found: install Arduino CLI or set ARDUINO_CLI_PATH.
- Unknown FQBN or missing platform: install the appropriate board core.
- Access denied / port busy: close other serial monitors and check driver/port permissions.
- Device not detected: test USB data cable, driver and board bootloader mode.
