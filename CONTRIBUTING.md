# Contributing

Thanks for wanting to help make **AI Running in Your Browser** better! This is a
small, dependency-free project — contributions of all sizes are welcome.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Project layout](#project-layout)
- [How to contribute](#how-to-contribute)
- [Style guide](#style-guide)
- [Opening an issue](#opening-an-issue)

## Code of conduct

Be kind, be constructive, and assume good intent. This project is a demo that
aims to be approachable for newcomers, so keep discussions friendly and inclusive.

## Getting started

1. Clone the repo:
   ```bash
   git clone https://github.com/<YOUR-USERNAME>/in-browser-ai.git
   cd in-browser-ai
   ```
2. Run the local server:
   ```bash
   python server.py        # or: npx serve .
   ```
3. Open `http://127.0.0.1:8000`.

No build step and no dependency install are needed — the app loads 🤗
Transformers.js from a CDN at runtime.

## Project layout

| File | Purpose |
|---|---|
| `start.bat` | Windows double-click launcher |
| `start.sh` | macOS / Linux double-click launcher |
| `start.py` | Cross-platform launcher (free-port detection + auto-open browser) |
| `index.html` | UI: tabs, controls, outputs, SEO/PWA meta |
| `styles.css` | Styling |
| `app.js` | All inference logic (pipelines, mic, upload, progress) |
| `server.py` | Zero-dependency static server (adds COOP/COEP headers) |
| `sw.js` | Service worker for offline + installable (PWA) |
| `manifest.webmanifest` | PWA app manifest |
| `icons/` | Generated icons + social share card |
| `scripts/generate_icons.py` | Regenerates `icons/` (requires Pillow) |

## How to contribute

1. **Fork** the repo and create a feature branch.
2. Make your change. Keep it small and focused.
3. **Verify it works** — the app must load via `python server.py` and run in a
   modern browser without console errors.
4. If you change code, run a quick syntax check:
   ```bash
   node --check app.js
   ```
   (and optionally `python -m py_compile server.py scripts/generate_icons.py`.)
5. Commit with a clear message and open a **pull request**.

## Style guide

- **JavaScript:** vanilla ES modules, no dependencies, 2-space indent, semicolons.
- **Keep model IDs** in the `MODELS` registry in `app.js` — never hard-code them
  further down. Only add models that actually exist on the Hugging Face Hub
  (verify with https://huggingface.co/api/models/<author>/<model>).
- **Follow the existing UX conventions** (status messages, progress callbacks).
- **Localization/multi-language features** should keep English as the default.

## Opening an issue

- **Bugs:** include your browser + OS versions, the model you used, and any
  console output.
- **Feature requests:** describe the use case and why it matters for on-device AI.