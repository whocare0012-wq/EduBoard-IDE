# Contributing to EduBoard IDE

Thank you for helping a volunteer-maintained, education-focused open-source project.

## Before starting
1. Read [ROADMAP.md](ROADMAP.md). Search existing Issues before opening a new one.
2. For a large change or new board family, open a feature request first to discuss the approach.
3. Keep changes small and focused; unrelated refactors should be a separate pull request.
4. Be respectful and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

See [docs/development.md](docs/development.md) for ESP32 / Arduino CLI setup. Real hardware is not required for documentation contributions, but hardware functionality must not be marked tested without a real device.

## Pull requests
- Fork the repository and open a pull request against `main`.
- Explain purpose, implementation details, testing evidence, and any user-facing behavior.
- Do not commit compiled binaries, credentials, API keys, student records, serial logs with personal data, or proprietary board resources.
- Document platform/board version when reporting actual hardware tests.
- Describe all new third-party libraries, hardware SDKs and their licenses.
- Add user-facing text in a form that can later be translated.

## Commit naming (recommended)
`feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## License of contributions
Unless clearly stated otherwise in an approved contribution, submitted code is contributed under this project's GPL-3.0 license. Contributors retain their own copyrights. No copyright assignment or CLA is requested at this time. Content with a distinct license must be identified before submission.

A pull request may be reviewed and not merged. The maintainer may prioritize stability and teaching usefulness over feature count.
