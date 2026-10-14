# EduBoard IDE

[简体中文](README.zh-CN.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

> A free, open-source desktop IDE for learning physical computing with Arduino C++, Blockly and MicroPython.

**Status: early development / pre-alpha. There is no supported release yet.** Do not assume that the source tree is classroom-ready or that hardware upload has been tested.

## Vision

EduBoard IDE is a student-friendly desktop coding environment for K–12 computer science and maker education. It aims to connect block-based learning, text-based programming, and real-world electronics in one application.

- **Students:** create and save projects, edit code, select a board, compile, upload, and read serial output.
- **Teachers (planned):** reusable lessons, hardware examples, assignment templates, and classroom-friendly workflows.
- **Offline-first:** no account or cloud service is required for core editing; board packages and dependencies must first be installed or provisioned.
- **Open development:** community contributions for boards, blocks, languages, documentation, and lessons.

## Scope and milestones

| Version | Goal | Status |
| --- | --- | --- |
| v0.1 | Windows desktop shell, Arduino C++ editor, ESP32 CLI integration, sketch management and serial monitoring | In progress |
| v0.2 | Blockly blocks and Arduino C++ generation | Planned |
| v0.3 | MicroPython firmware, REPL and file management | Planned |
| v1.0 | Stable teaching workflows and teacher resources | Planned |

The initial target is **Windows 10/11 + ESP32**. Broader board support is planned, not guaranteed.

## Development (pre-alpha)

Prerequisites: Node.js 22+, npm, and [Arduino CLI](https://docs.arduino.cc/arduino-cli/) installed on your computer.

```bash
git clone https://github.com/whocare0012-wq/EduBoard-IDE.git
cd EduBoard-IDE
npm ci
npm run dev
```

Arduino CLI must be available on PATH or set through the ARDUINO_CLI_PATH environment variable. ESP32 users must separately install the `esp32:esp32` board core. See [development guide](docs/development.md).

```bash
npm run typecheck
npm run build
```

Run `npm run check` for the software acceptance workflow and `npm run package:win` for an unsigned Windows preview. Windows CI retains the installer as a seven-day Actions artifact. See [release instructions](docs/release.md), [check evidence](docs/progress.md), and [pending physical gates](docs/hardware-acceptance.md). Real Blink compilation has passed; physical upload/serial and clean-machine acceptance remain pending.

## Project structure

```text
apps/desktop/src/main/       Electron main process
apps/desktop/src/preload/    Restricted IPC bridge
apps/desktop/src/renderer/   React student workspace
apps/desktop/src/shared/     IPC types
docs/                        Architecture and development documentation
examples/                    Hardware teaching sketches
.github/                     Contribution templates and CI
```

## Contribute

Start with [CONTRIBUTING.md](CONTRIBUTING.md), browse [Issues](https://github.com/whocare0012-wq/EduBoard-IDE/issues), or propose a small documentation improvement. The project is currently maintained by an individual volunteer.

## License

The repository's original LICENSE is **GNU GPL v3**. Third-party tools and libraries retain their own licenses; see [third-party notes](docs/third-party-licenses.md). Avoid copying code/assets from other IDEs without checking the applicable license.

EduBoard IDE is an independent community project and is **not affiliated with or endorsed by Arduino**, Google Blockly, or the maintainers of Mixly.
