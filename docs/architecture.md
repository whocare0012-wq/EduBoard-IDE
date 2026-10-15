# Architecture notes

**State:** design outline, subject to change.
The implementation separates project persistence (`projects.ts`), preferences (`settings.ts`), subprocess/serial lifecycle (`processes.ts`), Arduino orchestration (`arduino.ts`) and MicroPython operations (`micropython.ts`).

## Main layers

1. **Renderer** — React IDE with independent C++ / Python buffers, retained Blockly state and Monaco. No direct Node.js access.
2. **Preload** — restricted typed IPC surface exposed with contextBridge.
3. **Electron main** — file dialogs, local sketch persistence, child processes, serial session lifecycle.
4. **Tools** — Arduino CLI and Python tools are external executables invoked with argument arrays, without a shell. The owned Python bridge performs syntax parsing, chip probing and serial transport.
5. **Shared modules** — bounded project schema, pinned board/firmware catalogue, examples and language-specific block generators. A shared snapshot helper generates from both visible and retained workspaces.

The initial hardware family is ESP32. Arduino FQBN and MicroPython firmware IDs specify targets; neither proves a physical device is connected. Changing editing mode preserves all buffers and does not perform device operations beyond releasing a serial session when its language changes.

## Safety boundaries

- contextIsolation enabled; nodeIntegration disabled.
- Render processes may only perform allowed operations via typed IPC.
- File paths for project writes originate from OS dialogs and stay in the main process.
- Commands use child_process with shell disabled, timeouts and bounded captured output.
- Serial monitor should be stopped before upload so port handles do not conflict.
- Windows cancellation terminates the owned process tree and awaits closure; failure blocks the next device operation. Operation locks prevent changing a project/tool during a running operation.
- Compilation records source digest, target and explicit build directory. Upload uses that directory and rejects stale source or target changes.
- Targets come from the installed version in `core list` metadata, avoiding repeated platform data in `board listall`.
- IPC accepts only the application's main renderer frame. Permissions, navigation and new windows are denied. Production CSP permits local assets/workers only; dev relaxations apply only to the local server.
- Installation of cores, toolchain distribution and firmware writes require explicit action and clear diagnostics.

## Extension strategy

Board adapters should describe IDs, capabilities, tools, required cores and upload behavior. Block-to-code generators must be language-specific; we will not promise round-trip conversion from arbitrary edited code back into blocks.

Project documents preserve the active source, both independent text drafts, block layout and both target settings. See [schema](project-format.md). Host tool paths remain local preferences. New board adapters must describe capabilities, tools and upload behavior without widening the IPC surface unnecessarily.

## Editor and panel lifecycle

`CodeEditor.tsx` keeps separate Monaco models for both text languages and both generated previews. Mode changes save/restore view state and switch models rather than remount the editor. Only text model changes update drafts; previews never update text buffers. Each text model reports changes independently, including an undo that finishes after its tab is hidden. New/open increments the project session, detaches old subscriptions and disposes old models.

Save snapshots read live text models and retain a later edit as unsaved. Explicit generated-code adoption uses undoable model edits while normal input is disabled for the task. View state and undo history are transient and are not added to the project schema.

`useWorkspaceLayout.ts` observes the available main region, clamps output height, and chooses automatic preview visibility by region width. Manual choices last for the current application session. `ResizeHandle.tsx` uses pointer capture and keyboard-accessible separators; no global mouse listeners remain after a drag. Hiding output or preview does not dispose the editor models.
