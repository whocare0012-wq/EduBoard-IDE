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
- The current UI follow-ups use the existing `feat/ui-redesign` branch and its matching remote. Pushes never force-rewrite history.

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

## Optimization review after unified acceptance

- V0.3 commit `f2f1e9e` passed Windows/Linux CI including preview packaging and packaged mode/Python workflows: [run](https://github.com/whocare0012-wq/EduBoard-IDE/actions/runs/38617464279).
- [Code review](code-review.md) records the applied loading optimization, early device-argument validation, generation-error repair and port-sensitive file-list state, with further maintenance opportunities.
- Monaco still includes editor commands, while only C++/Python languages are registered. Renderer assets dropped from 28,585,013 bytes in 97 files to 10,197,043 bytes in 8 files (64.3% smaller).
- The optimization regression passed through `npm run package:win`: all unified software checks and the NSIS build. The packaged executable separately passed offline desktop editing, three-mode persistence/error repair and Python parsing/firmware cancellation. Development startup also passed.
- Preview at that milestone: `release/EduBoard-IDE-0.3.0-alpha.1-Windows-x64-Setup.exe`, 112724656 bytes; SHA-256 `c19b5172eec5511090d1ff0366ebc96c85db0319021f90074ffe5dd6223cf77c`; Authenticode `NotSigned`. No physical hardware operation was performed.

## Scoped UI follow-up / 0.3.0-alpha.2 (2026-10-15)

- Preserve the redesigned dark UI from `64221be`. Scope is the maintainer's three selected improvements: C3 wiring, editor state and adaptive panels.
- LED/button workspaces and wiring share one pin configuration (C3 MicroPython LED3/button5); classic defaults remain unchanged. Fresh C3 Python starter text also uses the same LED pin. Existing edited programs are not remapped.
- Independent text/preview models retain cursor, selection, scroll and undo/redo across mode switches. Generated-code adoption remains undoable; new/open starts a separate session and disposes old models. Saving reads the live text buffers and does not discard a later edit.
- Output can collapse and resize; generated preview automatically hides in narrow editing regions, with a manual override. Both separators support pointer drag, arrow keys, Home/End and double-click reset. Narrow REPL headers remain inside the toolbar.
- `npm run check` passed with 22 unit checks, offline foundation/blocks/modes/workspace/Python workflows, production build and 16 generated Python syntax cases. All four real catalogue firmware images passed their metadata checks. The workspace check covers model isolation, undo/redo, adoption, C3 LED/button wiring and 860×600 controls; source and packaged Windows CI include it.
- Screenshots of the actual wide/narrow workflows were inspected. No physical device operation was performed; hardware and fresh-machine gates remain pending.
- Real Blink compilation through the updated desktop passed with Arduino CLI 1.5.1 / ESP32 core 3.3.12. The alpha.2 packaged executable passed offline desktop, Python and workspace checks, including the new editor and resizers.
- Latest preview: `release/EduBoard-IDE-0.3.0-alpha.2-Windows-x64-Setup.exe`, 112368663 bytes; SHA-256 `e5cf87a9c83fafd13c03f4b7a48ed44263c1bdd9632a97bfb1e1759cfd2db2e1`; Authenticode `NotSigned`. The lockfile-only install/audit reported zero vulnerabilities; no new development tools were needed.
- Development startup also passed. This follow-up is committed on the existing `feat/ui-redesign` branch; CI also runs on `feat/**` pushes so the interface work is checked before integration.
- UI checks now explicitly control renderer viewports (1280×820 and the separate 860×600 case), covering hosted runners whose native window size is limited by their screen. Development startup, the full unified check and packaged workspace regression passed again with these explicit viewports.

## Diagnostic navigation / 0.3.0-alpha.3 (2026-10-15)

- The previous UI follow-up passed Windows/Linux CI at `51f9ffe`: [run](https://github.com/whocare0012-wq/EduBoard-IDE/actions/runs/38684196196).
- Python syntax and C++ compiler reports now produce Monaco inline markers and accessible clickable output. Locations belong to the checked source and its text/preview model; navigation restores the matching mode, expands a hidden generated preview and focuses the reported position.
- Changes to code/blocks, adoption, Arduino target changes, new/open and a new check remove affected old locations. Exact primary-file matching prevents a same-named dependency from navigating into the active program. Reports and output stay transient.
- Streamed failures are shown once. Supplemental cancellation, timeout, missing-tool and REPL-reconnect messages remain visible; repeated serial data is preserved. Logs remain bounded to the most recent 60,000 characters.
- The unified check passed: type check, 25 unit checks, production build, offline foundation/blocks/modes/workspace/diagnostics/Python workflows and 16 generated Python syntax cases. All four real firmware images passed metadata checks. The diagnostics check uses the real Python parser, fragmented compiler fixtures and actual editor input to verify Unicode columns, marker rendering, mouse/keyboard jumps, mode/preview isolation and stale edit/success/new/open cleanup. Source and packaged Windows CI now include it.
- Arduino CLI 1.5.1 / ESP32 core 3.3.12 passed a real desktop compile/error/repair cycle: Blink success, an undeclared identifier on line 5 / column 3, one-copy GCC output, inline marker, click navigation verified by inserting at the selected position, stale-location cleanup, then repaired Blink success. Actual Python, C++ and narrow generated-preview screenshots were inspected. No physical port was opened and no board was written.
- Development startup passed. The alpha.3 packaged executable passed offline desktop, three-mode, Python, workspace and diagnostics workflows, including the bundled Python bridge. No new tools or dependencies were installed.
- Preview: `release/EduBoard-IDE-0.3.0-alpha.3-Windows-x64-Setup.exe`, 112370635 bytes; SHA-256 `3fefe6070667eb2e9a5bb686d7bce0e289a84c84aab951c16883417755d3bf82`; Authenticode `NotSigned`. Physical board and clean-machine acceptance remain pending.
