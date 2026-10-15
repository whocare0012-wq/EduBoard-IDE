# EduBoard IDE

[简体中文](README.zh-CN.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

> An open-source desktop IDE for development boards, with directly switchable Blockly, Arduino C++ and MicroPython workspaces.

**Status: 0.3 development preview.** Windows previews are unsigned. Physical board upload, firmware flashing and fresh-machine acceptance remain pending because no development board is available.

## Features

- Switch directly between **Graphical / C++ / Python**. Independent text models preserve cursor, selection, scroll and undo/redo during the current project session; all source buffers and blocks are saved together.
- Resize panels with pointer or keyboard controls, collapse output, and show/hide generated code. Narrow workspaces hide the preview automatically until explicitly expanded.
- Generate Arduino C++ or MicroPython from blocks, preview the result, and explicitly adopt it into a text buffer. Edited text does not automatically convert back to blocks.
- Create, open and save projects; edit locally with Monaco and Blockly; save with Ctrl+S. Unsaved new/open/close prompts offer Save and continue, Discard, or Cancel; canceled or failed saves keep the current project open.
- Locate Python syntax and C++ compiler errors with inline markers and clickable output. Navigation restores the matching text buffer or generated preview; edits invalidate old locations, and streamed failures are displayed once.
- Configure Arduino CLI, select an ESP32 target, compile/upload and use the serial monitor.
- Configure Python tools, check syntax, execute MicroPython on a board, connect to REPL and transfer device files.
- Validate supported official ESP32 firmware before flashing, with explicit confirmation and chip/capacity/security checks.
- Use LED, button, DHT11, OLED (C++), and NeoPixel examples with wiring notes. C3 MicroPython LED3/button5 defaults share the same pin configuration as their displayed wiring.

Core editing requires no account or network. Toolchains, board packages, libraries and firmware must be provisioned separately. The project focuses on IDE functionality.

## Development goals

| Milestone | Scope |
| --- | --- |
| V0.1 | Windows desktop, Arduino C++, projects, ESP32 toolchain and serial monitor |
| V0.2 | Blockly persistence, C++ generation and board examples |
| V0.3 | MicroPython, firmware checks, REPL, device files and direct three-mode switching |

See [roadmap](ROADMAP.md) for checked software items and remaining physical acceptance gates. The primary target is **Windows 10/11 + ESP32**; supported MicroPython firmware variants are listed in [setup](docs/micropython.md).

## Run locally

Requires Node.js **22.12+** and npm. Arduino CLI and a configured Python environment are external tools.

```bash
git clone https://github.com/whocare0012-wq/EduBoard-IDE.git
cd EduBoard-IDE
npm ci
npm run dev
```

Select tools inside the IDE or set `ARDUINO_CLI_PATH`, `ARDUINO_CLI_CONFIG_FILE` and `EDUBOARD_PYTHON_PATH`. See [development setup](docs/development.md), [Chinese user guide](docs/user-guide.zh-CN.md) and [project format](docs/project-format.md).

Run `npm run check` for the unified software workflow. Real C++ compiler checks additionally require the installed ESP32 toolchain and sensor libraries. `npm run package:win` builds an unsigned Windows preview; Windows CI retains it as a seven-day Actions artifact. See [release instructions](docs/release.md) and [acceptance evidence](docs/progress.md).

See the [code review](docs/code-review.md) for optimizations after unified acceptance and remaining maintenance opportunities.

## Repository

```text
apps/desktop/src/main/       Files, tools and device operations
apps/desktop/src/preload/    Restricted IPC bridge
apps/desktop/src/renderer/   React IDE workspace
apps/desktop/src/shared/     Types, board catalogue and generators
apps/desktop/resources/     Owned Python tool bridge
docs/                       Setup, architecture and acceptance
examples/                   Arduino and MicroPython board examples
.github/                    CI and contribution templates
```

## Contribute and license

Read [CONTRIBUTING.md](CONTRIBUTING.md), report an [issue](https://github.com/whocare0012-wq/EduBoard-IDE/issues), or contribute board adapters, blocks, examples and documentation.

Repository code uses **GPL-3.0-only**. Third-party components retain their own licenses; see [dependency notes](docs/third-party-licenses.md). EduBoard IDE is independent and is not affiliated with Arduino, Google Blockly or Mixly.
