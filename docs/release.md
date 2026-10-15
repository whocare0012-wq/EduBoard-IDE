# Windows preview packaging

Preview packages are unsigned. Arduino CLI, board cores, Python, Python tool packages, USB drivers and firmware are provisioned separately; the installer includes the owned Python bridge.

```powershell
npm ci
npm run check
npm run package:dir
$env:EDUBOARD_SMOKE_EXE = "$PWD\release\win-unpacked\EduBoard IDE.exe"
npm run test:desktop
npm run test:modes
npm run test:python
npm run test:workspace
npm run test:diagnostics
Remove-Item Env:EDUBOARD_SMOKE_EXE
npm run package:win
```

`release/win-unpacked/` is the packaged application. `release/EduBoard-IDE-<version>-Windows-x64-Setup.exe` is the NSIS preview installer. Generated distributions are ignored by Git; source and dependency versions are committed. `--publish never` prevents automatic external publication.

In this maintainer's environment, set `ELECTRON_BUILDER_CACHE` and `electron_config_cache` to directories under `D:\Software\EduBoard-Tools`. Separately provisioned CLI/core data and configuration use that same tool root. Run `scripts/setup-windows-tools.ps1 -InstallEsp32` to verify/install the pinned developer toolchain and `scripts/start-local.ps1` to launch it.

A packaged check exercises bundled editing, independent modes, Python parsing, adaptive panels and diagnostic markers/navigation. It does not replace fresh-machine installation or [physical acceptance](hardware-acceptance.md).

Before a stable release, complete physical acceptance, generate exact third-party notices, review the audit, verify uninstall/update behavior, and sign the executable and installer with a maintainer-controlled certificate. Signing secrets never belong in the repository.
