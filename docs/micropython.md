# MicroPython tools and firmware / 工具与固件

Device operations require a separately configured Python environment. The Windows installer includes the owned `tool_bridge.py` helper, but does not bundle Python, mpremote, esptool, USB drivers or firmware.

## Tool setup

Maintainer provisioning uses only `D:\Software\EduBoard-Tools`:

```powershell
./scripts/setup-python-tools.ps1
$env:EDUBOARD_PYTHON_PATH = 'D:\Software\EduBoard-Tools\micropython-venv\Scripts\python.exe'
npm run dev
```

Python 3.11.9 was used for acceptance. `requirements-tools.txt` pins mpremote 1.29.0, esptool 5.5.0, pyserial 3.5 and their dependencies. In the IDE, select this environment's Python executable. Tool-info and serial enumeration do not open a board connection. Syntax checks use `ast.parse`; project programs are never executed on the host.

For offline deployment, provision Arduino CLI/core/libraries and the Python environment while online, or build a wheel directory with `pip download -r requirements-tools.txt` and install using `--no-index --find-links`. Transfer the matching Python runtime and wheel set to the target Windows architecture; a copied venv alone is not a portable Python installation. Preserve upstream source and license notices. The IDE's Monaco, Blockly and media load locally.

## Pinned firmware matrix

All entries use official MicroPython **v1.29.0 (2026-08-24)** images and require at least 4 MiB flash. Download links are in the firmware panel and the catalogue `apps/desktop/src/shared/boards.ts`.

| Target | Official page | Image | Flash offset | Constraints |
| --- | --- | --- | --- | --- |
| ESP32 Generic | [ESP32](https://micropython.org/download/ESP32_GENERIC/) | ESP32_GENERIC-20260824-v1.29.0.bin | 0x1000 | Dual core; excludes UNICORE / D2WD |
| ESP32-C3 Generic | [C3](https://micropython.org/download/ESP32_GENERIC_C3/) | ESP32_GENERIC_C3-20260824-v1.29.0.bin | 0x0 | Revision 0.3 or later |
| ESP32-S3 Generic | [S3](https://micropython.org/download/ESP32_GENERIC_S3/) | ESP32_GENERIC_S3-20260824-v1.29.0.bin | 0x0 | No PSRAM or ordinary SPI PSRAM |
| ESP32-S3 Octal | [S3 variants](https://micropython.org/download/ESP32_GENERIC_S3/) | ESP32_GENERIC_S3-SPIRAM_OCT-20260824-v1.29.0.bin | 0x0 | Octal PSRAM module |

The catalogue pins SHA-256 calculated from these official HTTPS downloads. These are integrity pins, not independent vendor signatures. Image magic, chip ID, size and SHA-256 are checked before confirmation and again before use. Flashing probes the actual chip, revision, flash capacity, secure boot and encryption; unsupported or protected devices are refused. PSRAM variant selection still requires checking the module's specification.

The native erase/write confirmation displays target, explicit serial port, filename and full digest. Cancel returns before any device probing. Confirmed writes use immutable staged bytes and one `esptool write-flash --erase-all` operation with the specified offset, without `--force`. **All firmware and device files are erased.** Firmware is not downloaded or flashed automatically.

## Device operations

- Run uses [mpremote](https://docs.micropython.org/en/latest/reference/mpremote.html) `connect <port> run --no-follow`, then reconnects the serial bridge. It starts RAM execution; it does not save `main.py`. Initial output can precede reconnection.
- REPL waits for an explicit bridge readiness marker before showing connected state. The bridge avoids DTR/RTS resets and preserves UTF-8 output. Interrupt sends Ctrl+C and Ctrl+B.
- Files use explicit-port mpremote operations. Listing shows up to 256 root entries. Upload/delete require confirmation; download commits only a successful regular file up to 4 MB. File operations can reset/interrupt a running MicroPython program through mpremote's normal raw-REPL behavior.
- Existing serial sessions close before a new device operation. Cancellation targets only the owned process tree and waits for closure.

Generated examples cover four board/firmware variants × LED, button, DHT11 and NeoPixel. Host syntax checks do not establish device-module or physical-pin compatibility. SH1106 blocks intentionally report unsupported MicroPython generation. Real firmware boot, REPL and file transfers remain in [hardware acceptance](hardware-acceptance.md).
