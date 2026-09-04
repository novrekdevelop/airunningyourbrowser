"""Minimal static file server for the "AI Running in Your Browser" demo.

The app itself is pure front-end; this server only serves static files so the
ES module (app.js) and mic/WebAssembly features work correctly. The browser
downloads transformers.js + the ONNX models from the Hugging Face CDN.

The COOP/COEP response headers enable cross-origin isolation, which unlocks the
multithreaded WebAssembly runtime (faster transcriptions on multi-core CPUs).

Usage:
    python server.py              # http://127.0.0.1:8000 (opens browser)
    python server.py --port 9000  # custom port
    python server.py --no-browser # don't auto-open the browser
    python server.py --host 0.0.0.0 --port 8000  # expose to the LAN

No third-party dependencies are required (Python standard library only).
"""

import argparse
import http.server
import socketserver
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Cross-origin isolation lets the browser use a multithreaded WASM
        # runtime (SharedArrayBuffer), which speeds up on-device inference.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[server] %s\n" % (fmt % args))


def parse_args():
    p = argparse.ArgumentParser(description="Serve the in-browser AI demo.")
    p.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    p.add_argument("--host", default="127.0.0.1", help="Host (default: 127.0.0.1)")
    p.add_argument("--no-browser", action="store_true", help="Do not open the browser")
    return p.parse_args()


def main():
    args = parse_args()
    url = f"http://{args.host}:{args.port}"
    with socketserver.ThreadingTCPServer((args.host, args.port), Handler) as httpd:
        print(f"AI Running in Your Browser → {url}")
        print("Models download once from the Hugging Face Hub, then run offline on-device.")
        if not args.no_browser:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBye!")


if __name__ == "__main__":
    main()
