# Architecture notes

**State:** design outline, subject to change.

## Main layers

1. **Renderer** — React student workspace and Monaco code editor. No direct Node.js access.
2. **Preload** — restricted typed IPC surface exposed with contextBridge.
3. **Electron main** — file dialogs, local sketch persistence, child processes, serial session lifecycle.
4. **Tools** — Arduino CLI is an external executable invoked with an argument array (not through a shell).
5. **Future adapters** — board configuration, Blockly generators, MicroPython runtime and teaching projects.

The first implementation intentionally focuses on a single supported pathway: ESP32 + Arduino C++. A board FQBN identifies a toolchain target, not a guarantee that a physical device is connected.

## Safety boundaries

- contextIsolation enabled; nodeIntegration disabled.
- Render processes may only perform allowed operations via typed IPC.
- File paths for project writes originate from OS dialogs and stay in the main process.
- Commands use child_process with shell disabled, timeouts and bounded captured output.
- Serial monitor should be stopped before upload so port handles do not conflict.
- Installation of cores, toolchain distribution and firmware writes require explicit action and clear diagnostics.

## Future extension strategy

Board adapters should describe IDs, capabilities, tools, required cores and upload behavior. Block-to-code generators must be language-specific; we will not promise round-trip conversion from arbitrary edited code back into blocks.

A teaching project may contain source, build target, wiring notes, learning objectives, assets and optional assessments. Document/schema versions must be explicit when this is implemented.
