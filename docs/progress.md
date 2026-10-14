# Development and acceptance log / 开发与验收记录

Software milestones are checked, documented, committed and pushed individually. A software check is not a physical hardware acceptance test. No development board is currently available; physical ESP32 upload, serial output, MicroPython flashing and clean-machine acceptance remain pending.

## Execution order

1. V0.1 foundation: pinned dependencies, offline editor, reliable sketch persistence and desktop checks.
2. V0.1 tools: Arduino CLI configuration, boards, compilation, serial lifecycle and Windows preview packaging.
3. V0.2: Blockly project persistence, C++ generators and sensor examples.
4. V0.3: board matrix, guarded firmware flashing, REPL, files, MicroPython generation and direct Graphical / C++ / Python switching.
5. Unified software checks, then a focused code optimization review.

No version is declared stable until its remaining real-device and release acceptance gates pass. Work may continue on independently testable software while those gates are pending.

## Local environment

- Checkout: `D:\CodeProject\EduBoard-IDE`.
- Existing Git, Node.js and Python are under `D:\Software`.
- Newly downloaded developer tool archives and caches use `D:\Software\EduBoard-Tools`.
- Project dependencies are local to this checkout, with exact versions in `package-lock.json`.
- Development is authorized against this repository's `main` branch. Pushes never force-rewrite history.

## Foundation milestone

Completed on 2026-10-14 (maintainer timezone: America/New_York):

- Exact direct dependency versions, official npm registry and committed lockfile; updated desktop runtime/tooling; DOMPurify override to the patched 3.4.17 because Monaco 0.57.0 pins an affected version.
- Offline Monaco with C++ highlighting, keyboard editing and accessible textarea input. Full editor commands are included; CDN loading is disabled.
- Valid Arduino folder/name rules, byte-bounded UTF-8 reads, atomic saves, explicit existing-project overwrite confirmation, unsaved new/open/close protection and Ctrl+S.
- Main-frame IPC authorization, isolated/sandboxed renderer, denied permissions and navigation, production content security policy.
- Type checking, two filesystem unit checks and the real Windows Electron workflow passed: offline editing, Unicode save/reopen, dirty-edit cancel/discard, missing CLI error handling and renderer isolation. No remote editor requests or uncaught renderer errors were observed.
- The final production dependency audit and all checks passed again after the DOMPurify override; the audit reported zero vulnerabilities.

Pending: a connected ESP32 and fresh Windows-machine acceptance. This milestone completes software foundation work and does not claim V0.1 hardware completion.

## Arduino tools and Windows preview milestone

- Foundation CI passed for commit `9d4348b` on Windows and Linux: [run](https://github.com/whocare0012-wq/EduBoard-IDE/actions/runs/38596943137).
- Tool selection and optional CLI YAML configuration persist locally. The UI discovers installed board targets/serial ports and offers an explicit pinned ESP32 core install action.
- Bounded real-time output, shell-free arguments, cancellation/timeouts, exclusive operation locks and stale-build rejection are implemented. Windows serial shutdown kills the owned process tree and awaits closure before upload.
- Seven unit checks passed: literal arguments, split UTF-8 output, cancellation, timeout, failed serial startup and compile/upload sequencing. These transport fixtures are not hardware acceptance.
- Real Arduino CLI 1.5.1 with ESP32 core 3.3.12 compiled Blink through the offline desktop UI: 271672 bytes program storage and 22116 bytes global variables for `esp32:esp32:esp32`. CLI/core/download data live under `D:\Software\EduBoard-Tools`.
- The 0.1.0-alpha.1 NSIS installer was generated locally (114777621 bytes; SHA-256 `8f31cf17753bdede929fe50ffb7bf2bee35354cc320ee35a41d587d71aad797d`). Authenticode: `NotSigned`. The packaged executable passed the offline desktop workflow.
- `@electron/get` is overridden to 5.1.0 to remove the older packaging proxy/logging advisory. Full npm audit reports zero vulnerabilities.
- Development startup passed after binding the local renderer server to `127.0.0.1`, avoiding a Windows localhost address-family mismatch. CI also builds an unsigned preview and saves it as a seven-day Actions artifact.

Physical upload/serial tests and clean-machine installer validation remain pending in [hardware acceptance](hardware-acceptance.md). An unsigned preview is not a stable release.

## Blockly / V0.2 software milestone

- Previous Arduino/preview CI passed: [run for `75cb155`](https://github.com/whocare0012-wq/EduBoard-IDE/actions/runs/38600919257).
- Blockly 13.4.0 and its media are local. GPIO, numeric variables, arithmetic, loops, conditions, delays, serial output and sensor/display blocks generate C++ through a dedicated generator.
- Versioned `.eduboard.json` files preserve layout, source and target, with source companions for Arduino CLI. Legacy `.ino` editing remains supported. Text copies save the original blocks first and do not claim reverse conversion.
- Twelve unit checks passed, covering file persistence, process safety, Blockly round-trips, numeric division, invalid roots/indices, unsupported formats and bounded mutation state.
- Real offline desktop checks passed for visible code, field changes, block save/reopen, editable text copies and canceled overwrite. Canvas fitting, readable toolbox colors and editor remounts fix issues found by screenshot inspection.
- All five generated examples compiled with the real ESP32 3.3.12 toolchain and the pinned sensor libraries. Program/global bytes: LED 271672/22116; button 271564/22116; DHT11 273868/22132; SH1106 306400/23684; NeoPixel 288929/22844. No physical upload was performed.
- Generated source and project companions live under `examples/Lesson_*`. Wiring, dependency versions and format details are documented. Physical sensor behavior remains pending. The existing directory names are retained for compatibility.

## MicroPython and pure IDE / V0.3 software milestone

- Blockly CI for `ca49cde` passed on Windows/Linux: [run](https://github.com/whocare0012-wq/EduBoard-IDE/actions/runs/38607692053).
- Scope follows the maintainer's revised request: a pure development-board IDE. README (both languages), roadmap, UI and acceptance documents remove the former classroom stage. Examples retain wiring information.
- Direct Graphical / C++ / Python controls preserve independent text buffers and block state. The backward-compatible v1 extension saves all three plus both board settings. Explicit generated-code adoption confirms replacement of existing text.
- A configured Python environment provides mpremote 1.29.0, esptool 5.5.0 and pyserial 3.5. The owned bridge checks syntax without executing project code on the host, probes chips, and provides UTF-8 REPL transport with an explicit ready handshake.
- Device run / file operations release existing serial sessions and use explicit ports. Firmware selection pins four official images; confirmation precedes device probing, and mismatched chip/revision/capacity/security or changed image bytes prevent writes. No physical port was opened by acceptance scripts.
- Unified `npm run check` passed: type check, 16 unit checks, production build, offline foundation / Blockly / three-mode / Python UI workflows, and 16 generated Python syntax cases. Tests include canceled replacement, saved-mode switching without false dirty state, syntax failure without host execution, invalid firmware, and cancellation before flashing.
- All four downloaded official firmware images passed header, chip ID, size, offset and SHA-256 checks. The real Python bridge passed ready/UTF-8/EOF checks with pyserial in-memory loopback.
- Real CLI compiled Blink through the current offline UI and all five C++ examples against ESP32 core 3.3.12. Sensor code sizes match the V0.2 figures. Full npm audit reported zero vulnerabilities.
- Setup, firmware matrix, offline provisioning, file semantics and project format are documented. All newly installed tools and caches remain below `D:\Software\EduBoard-Tools`.

Physical flashing, device execution/REPL/files, upload/serial and fresh-machine installation remain pending. The software milestone does not declare a stable hardware-validated release.
