# Developer setup / 开发环境

The following instructions target **Windows 10/11** and Node.js **22 or later**.

## Install and run
1. Install Node.js and Git.
2. Install [Arduino CLI](https://arduino.github.io/arduino-cli/latest/installation/) separately.
3. Clone this repository.
4. Run `npm ci` and `npm run dev`.
5. Run `npm run check` before committing a development milestone. This includes type checking, unit checks, production bundling and a real Electron desktop workflow on Windows.

Monaco and its language assets are bundled locally. Editing and saving do not need an internet connection. The desktop check deliberately disables networking and replaces only native file dialogs; project writes still run through the actual restricted IPC bridge and main-process filesystem code.

`npm run test:desktop` requires a previously built `out/` directory and the installed Electron executable. Check screenshots go to ignored `output/playwright/`. No connected board is needed for these checks. `EDUBOARD_USER_DATA` can isolate a check profile; omit it in normal use.

Sketch names use an ASCII letter or underscore first, followed by letters, digits, underscores or hyphens, up to 63 characters. Unicode parent directories and source text are supported. Open a primary sketch in its same-named directory (`Blink/Blink.ino`). Writes use a sibling temporary file and rename; failed writes do not change the active project path. New/open/close actions guard unsaved edits; Ctrl+S saves.

Arduino CLI must be discoverable as `arduino-cli` on PATH. Alternatively, set `ARDUINO_CLI_PATH` to the absolute executable path before starting the development process.

## ESP32 setup

The development acceptance toolchain is Arduino CLI 1.5.1 and `esp32:esp32@3.3.12`. UI tool selections persist locally. The optional maintainer provisioning script stores CLI/core/tools under `D:\Software\EduBoard-Tools`; other users may provision their own paths. Runtime core installation occurs only after the user selects the install action.

To run the real compiler check (it never uploads), set `ARDUINO_CLI_PATH` and optionally `ARDUINO_CLI_CONFIG_FILE`, then run `npm run test:arduino`. Transport-fixture unit checks exercise cancellation, process-tree closure and stale-build rejection but are not hardware tests.

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
`npm run build` creates development build output, **not** a signed Windows installer. Dependencies are pinned in the committed lockfile; CI uses `npm ci` on Windows and Linux. Preview packaging follows in the next milestone. See [acceptance log](progress.md) for passed checks and outstanding hardware/release gates.

## Troubleshooting
- `ENOENT` or CLI not found: install Arduino CLI or set ARDUINO_CLI_PATH.
- Unknown FQBN or missing platform: install the appropriate board core.
- Access denied / port busy: close other serial monitors and check driver/port permissions.
- Device not detected: test USB data cable, driver and board bootloader mode.
