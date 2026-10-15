# Development roadmap / 开发路线图

Scope: a desktop IDE with directly switchable graphical, Arduino C++ and MicroPython workspaces. No delivery dates are promised.

## V0.1 — Windows Arduino C++ foundation

- [x] Electron / React development startup and CI
- [x] Create, open and save valid Arduino sketches
- [x] Offline Monaco editor
- [x] Configurable Arduino CLI and ESP32 core installation
- [x] Installed board targets and serial-port detection
- [x] Real Blink compilation through the IDE
- [x] Upload orchestration, serial lifecycle, cancellation and stale-build safeguards (software checks)
- [x] Build and launch an unsigned Windows preview
- [x] Documentation and renderer / IPC security checks
- [ ] Real ESP32 upload, serial output and disconnect recovery
- [ ] Clean Windows 10/11 installation, uninstall and driver acceptance

## V0.2 — Graphical IDE

- [x] Local Blockly workspace and versioned project persistence
- [x] GPIO, numeric variables, arithmetic, loops, conditions and delays
- [x] Arduino C++ generation and visible code preview
- [x] LED, button, DHT11, SH1106 OLED and NeoPixel examples with real compiler checks
- [x] Explicit adoption into editable code without promising reverse conversion
- [ ] Physical example behavior and wiring acceptance

## V0.3 — MicroPython and direct mode switching

- [x] ESP32 / ESP32-C3 / ESP32-S3 firmware catalogue and pinned image checks
- [x] Confirmed erase/write with actual chip, revision, capacity and security checks
- [x] Syntax parsing, REPL, device execution and file transfers (software / transport checks)
- [x] MicroPython-specific block generator; unsupported OLED blocks report an error
- [x] Direct Graphical / C++ / Python controls preserving all three workspaces
- [x] Save/reopen independent text drafts, block state and board settings
- [x] Preserve per-language editor view state and undo/redo during a project session
- [x] Adaptive output / preview panels and C3 wiring consistent with generated defaults
- [x] Tool provisioning and offline setup documentation
- [ ] Actual firmware boot, REPL, file transfers and block programs on hardware

Each software target must pass functional checks before documentation, commit and push. Stable releases also require the remaining hardware gates, release signing and clean-machine validation. See [acceptance record](docs/progress.md).
