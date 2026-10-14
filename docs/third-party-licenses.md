# Third-party dependencies and redistribution

The repository is licensed under GPL-3.0. This document is **not** a substitute for reviewing each dependency's exact version and published license before distributing an installer.

| Component | Planned role | Upstream |
| --- | --- | --- |
| Electron | Desktop shell | https://github.com/electron/electron |
| React | User interface | https://github.com/facebook/react |
| Monaco Editor | Text editor | https://github.com/microsoft/monaco-editor |
| Arduino CLI | Separate external compiler/uploader executable | https://github.com/arduino/arduino-cli |
| Blockly 13.4.0 | Local block editor and project serialization (Apache-2.0) | https://github.com/RaspberryPiFoundation/blockly |
| MicroPython / mpremote 1.29.0 | Board-side Python and external communication tools (MIT) | https://github.com/micropython/micropython |

**V0.1 distribution policy:** Do not bundle Arduino CLI or board packages until their source availability, license notices, install locations, download provenance, and redistributable permissions are verified. Local development uses separately installed Arduino CLI.

Do not copy Mixly proprietary branding, artwork or code without verifying its specific repository's license. The project is independent and unaffiliated with Arduino, Google or Mixly.

Before a release, generate an exact lockfile, a dependency license report, and a third-party notices file. Review any native code, firmware and driver licenses separately.

Blockly media assets are copied from the pinned package during build and retain its Apache-2.0 license. Its jsdom peer dependency is used by Node-based generator checks and is excluded from browser code. Arduino example libraries are installed separately: DHT sensor library and Adafruit BusIO (MIT), Unified Sensor (Apache-2.0), GFX and SH110X (BSD-style licenses in their source distributions), and NeoPixel (LGPL-3.0). These classifications were checked against the installed license files. They are not bundled in the Windows installer; their source/license files remain in the toolchain's library folders. Packaging uses electron-builder 26.15.3 (MIT) with @electron/get 5.1.0 (MIT).

The foundation uses Electron 44.7.2 (MIT), React 18.3.1 (MIT), @monaco-editor/react 4.7.0 (MIT), Monaco 0.57.0 (MIT), and DOMPurify 3.4.17 (Apache-2.0 OR MPL-2.0). DOMPurify overrides Monaco's pinned dependency to remove known advisories. Playwright 1.64.1 (Apache-2.0) and tsx 4.23.15 (MIT) are development-only check tools. Exact transitive versions and registry integrity hashes are in `package-lock.json`.

MicroPython tooling is separately installed: mpremote 1.29.0 (MIT), esptool 5.5.0 (GPL-2.0-or-later) and pyserial 3.5 (BSD). Exact transitive versions are in `requirements-tools.txt`; these classifications were read from the installed package metadata. The installer ships the project's GPL-3.0-only Python bridge and no firmware or Python runtime. Firmware catalogue SHA-256 values come from official HTTPS image downloads.
