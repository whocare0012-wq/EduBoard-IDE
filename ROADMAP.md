# Development roadmap / 开发路线图

Progress is tracked in GitHub Issues. Dates below are intentionally not promised.

## V0.1 — Windows Arduino C++ foundation
- [x] Electron / React desktop development startup and CI build pass
- [x] Create, open, save Arduino sketches with valid sketch-folder structure
- [x] Monaco C++ editing with student-friendly defaults
- [x] Detect Arduino CLI and provide actionable setup guidance
- [x] Support ESP32 board FQBN, detect available serial ports
- [ ] Compile and upload a real Blink sketch with Arduino CLI (real compiler passed; physical upload pending)
- [x] Serial monitor with selectable baud rate and safe release before uploading (transport checks passed; hardware gate remains below)
- [ ] Real ESP32 hardware acceptance test on Windows 10/11
- [ ] Windows installer and clean-machine validation (unsigned preview built and launched; clean-machine gate pending)
- [x] Basic documentation, error handling and security review

**Definition of Done:** A student on a supported Windows machine can create, compile and upload Blink to a real ESP32, then view serial output without using a second IDE.

## V0.2 — Block-based learning
- [x] Blockly workspace and save/load project format
- [x] GPIO, variable, loop, condition and delay blocks
- [x] Arduino C++ code generator
- [x] LED, button, DHT11, SH1106 OLED and NeoPixel examples (real compilation passed; physical behavior pending)
- [x] Make generated code visible without claiming automatic code-to-blocks conversion

## V0.3 — MicroPython
- [ ] Supported board/firmware matrix
- [ ] Firmware flashing safeguards
- [ ] REPL, script execution and file transfers
- [ ] MicroPython-specific Blockly generators

## V1.0 — Classroom readiness
- [ ] Project templates with learning goals and wiring guidance
- [ ] Teacher resource authoring and assignment handoff
- [ ] Offline deployment documentation and multilingual help
- [ ] Accessibility testing, release signing strategy, and long-term maintenance policy

## Non-goals for V0.1
No cloud accounts, student data collection, remote classroom monitoring, auto-updater, AI chat, or all-board/all-language compatibility.
