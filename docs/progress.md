# Development and acceptance log / 开发与验收记录

Software milestones are checked, documented, committed and pushed individually. A software check is not a physical hardware acceptance test. The maintainer has confirmed that no development board is currently available; physical ESP32 upload, serial output, MicroPython flashing and clean-machine classroom acceptance remain pending.

## Execution order

1. V0.1 foundation: pinned dependencies, offline editor, reliable sketch persistence and desktop checks.
2. V0.1 tools: Arduino CLI configuration, boards, compilation, serial lifecycle and Windows preview packaging.
3. V0.2: Blockly project persistence, C++ generators and sensor examples.
4. V0.3: board matrix, guarded firmware flashing, REPL, files and MicroPython block generation.
5. V1.0 software preparation: teaching templates, local teacher handoff, offline help, accessibility and maintenance documents.

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
