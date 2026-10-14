# Windows preview packaging

Preview packages are unsigned and are not stable classroom releases. No Arduino CLI, board core, USB driver or firmware binary is redistributed in the installer.

```powershell
npm ci
npm run check
npm run package:dir
$env:EDUBOARD_SMOKE_EXE = "$PWD\release\win-unpacked\EduBoard IDE.exe"
npm run test:desktop
Remove-Item Env:EDUBOARD_SMOKE_EXE
npm run package:win
```

`release/win-unpacked/` is the packaged application. `release/EduBoard-IDE-<version>-Windows-x64-Setup.exe` is the NSIS preview installer. Generated distributions are ignored by Git; source and dependency versions are committed. `--publish never` prevents automatic external publication.

In this maintainer's environment, set `ELECTRON_BUILDER_CACHE` and `electron_config_cache` to directories under `D:\Software\EduBoard-Tools`. Separately provisioned CLI/core data and configuration use that same tool root. Run `scripts/setup-windows-tools.ps1 -InstallEsp32` to verify/install the pinned developer toolchain and `scripts/start-local.ps1` to launch it.

A packaged-launch check proves the bundled application starts and edits/saves. It does not prove the installer is safe on a clean machine or replace [physical acceptance](hardware-acceptance.md).

Before a stable release, complete physical acceptance, generate exact third-party notices, review the audit, verify uninstall/update behavior, and sign the executable and installer with a maintainer-controlled certificate. Signing secrets never belong in the repository.
