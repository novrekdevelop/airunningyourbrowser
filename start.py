#!/usr/bin/env python3
"""Launch "AI Running in Your Browser" with a single click.

This is the cross-platform launcher. It picks a free port, starts the static
server, and opens your default browser automatically — no console fiddling.

Why a server (not just opening index.html)?
- The app imports JS modules (CORS requires http, not file://).
- The microphone needs a *secure context* (http://localhost or https).
- The COOP/COEP headers unlock the faster multithreaded WebAssembly runtime.

How to run it:
    python start.py              # works on Windows / macOS / Linux
    python start.py 9000         # force a specific port

Windows / macOS / Linux users without Python can double-click the launcher
script for their OS instead (start.bat on Windows, start.sh on macOS/Linux).
"""
import http.server
import socketserver
import sys
import webbrowser
from pathlib import Path
from socket import socket

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8000


def find_free_port(host, start=DEFAULT_PORT, tries=50):
    """Return the first free port at or after `start`."""
    for port in range(start, start + tries):
        with socket() as s:
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue  # in use, try the next one
    raise RuntimeError(f"No free port found between {start} and {start + tries - 1}.")


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


def main():
    host = "127.0.0.1"
    try:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else find_free_port(host)
    except ValueError:
        port = find_free_port(host)

    url = f"http://{host}:{port}"
    print("=" * 62)
    print("  🧠  AI Running in Your Browser")
    print("=" * 62)
    print(f"   Opening: {url}")
    print("   Models download once from the Hugging Face Hub, then run offline.")
    print("   Close this window to stop the app.\n")

    with socketserver.ThreadingTCPServer((host, port), Handler) as httpd:
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nBye! 👋")


if __name__ == "__main__":
    main()