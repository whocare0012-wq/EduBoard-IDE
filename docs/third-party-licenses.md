# Third-party dependencies and redistribution

The repository is licensed under GPL-3.0. This document is **not** a substitute for reviewing each dependency's exact version and published license before distributing an installer.

| Component | Planned role | Upstream |
| --- | --- | --- |
| Electron | Desktop shell | https://github.com/electron/electron |
| React | User interface | https://github.com/facebook/react |
| Monaco Editor | Text editor | https://github.com/microsoft/monaco-editor |
| Arduino CLI | Separate external compiler/uploader executable | https://github.com/arduino/arduino-cli |
| Google Blockly (later) | Block editor and code generators | https://github.com/google/blockly |
| MicroPython / mpremote (later) | Board-side Python and communication tools | https://github.com/micropython/micropython |

**V0.1 distribution policy:** Do not bundle Arduino CLI or board packages until their source availability, license notices, install locations, download provenance, and redistributable permissions are verified. Local development uses separately installed Arduino CLI.

Do not copy Mixly proprietary branding, artwork or code without verifying its specific repository's license. The project is independent and unaffiliated with Arduino, Google or Mixly.

Before a release, generate an exact lockfile, a dependency license report, and a third-party notices file. Review any native code, firmware and driver licenses separately.
