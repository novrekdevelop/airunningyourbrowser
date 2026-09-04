# Security Policy

## Supported versions

| Version | Status |
|---|---|
| Latest release | ✅ Supported |
| Older releases | ❌ Best-effort only |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email the maintainer privately at the address listed on the GitHub
repository profile (or use GitHub's side-channel "Report a vulnerability" option).

Please include:

- The affected file(s) and version/tag.
- A short description of the issue and its impact.
- Steps to reproduce, if possible.

You should receive an acknowledgment within a few days. We'll work with you to
confirm the issue and coordinate a fix and release.

## Notes on this project's security surface

This app is a **fully client-side** demo: all inference runs in your browser via
WebAssembly. It has no backend and no API keys, which keeps the attack surface
small. A few things to know:

- The app loads the `@huggingface/transformers` library from the jsDelivr CDN and
  model weights from the Hugging Face Hub. Deliveries are served over HTTPS.
  Models are pinned to specific `Xenova/*` repos in `MODELS` (`app.js`).
- Everything runs in the user's browser **sandbox**; no data is sent to any
  server.
- Do **not** add telemetry, analytics, or network calls — this project's core
  promise is privacy.