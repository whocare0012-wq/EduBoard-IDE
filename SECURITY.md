# Security policy

**Status:** Pre-alpha. No supported versions or security guarantees yet.

## Report vulnerabilities privately
Please do **not** post exploit details, secrets or student information in a public GitHub Issue. Use GitHub's private vulnerability reporting feature if the repository has it enabled; otherwise contact the maintainer privately via their GitHub profile, without posting sensitive proof-of-concept content publicly.

Include affected version/commit, reproduction steps, impact, and a suggested mitigation if available. Response times are best-effort for a volunteer-maintained project.

## Security approach
- Keep Node.js and filesystem access in the Electron main process.
- Expose only a narrow, validated IPC bridge to the renderer.
- Never run untrusted user input through a shell command.
- Treat USB device metadata and generated project code as untrusted.
- Do not collect students' personal information by default.
- Do not silently download and execute board binaries.
- Verify third-party license and provenance before shipping binaries.

No auto-update, telemetry, remote access, or online account subsystem is planned for V0.1.
