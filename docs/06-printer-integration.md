# Printer Integration

Three device classes per terminal: thermal receipt printers, barcode/price label printers, and
regular A4 invoice printing.

## 1. Thermal receipts

**`node-thermal-printer`** running in the Electron **main process** (not the renderer) —
actively maintained, supports Epson/Star/Tanca/Custom/Brother, and supports USB, Serial, and TCP
network transport. Running in the main process gives full OS-level USB/serial/network access
with no browser sandbox limits; the Next.js renderer invokes it via IPC.

Alternatives considered:

- **QZ Tray** — still actively maintained, but is a separately-installed local signing/print
  daemon that browsers talk to over websocket. Adds an extra install step plus
  certificate/signing setup per terminal — friction not needed once Electron is the primary
  shell. Reserved for the bare-browser fallback only (see §4).
- **Web Serial / WebUSB** — Chromium-only (~72-76% global support), no Safari, no stable Firefox
  support. Usable for USB printers in a Chrome-only fallback but doesn't cover network/serial
  printers well — not reliable as a primary strategy.
- Raw ESC/POS over a TCP socket is still the correct underlying approach for network-connected
  thermal printers; `node-thermal-printer`'s network interface already wraps this.

## 2. Barcode / price labels (ZPL)

No dominant, fully-maintained library exists for this in 2025-2026 — **raw ZPL string
generation + raw socket (port 9100) or USB send is still the standard approach**. Build a small
internal ZPL/EPL template module (`packages/print-templates`) rather than depending on a heavy
or unmaintained package. `node-zpl` (TypeScript ZPL generator) is usable as a templating helper
for partial coverage; Zebra's official **Zebra Browser Print** is an option if going
browser-first but ties the app to Zebra's local agent. For TSC/EPL printers, no notable Node
library exists — raw EPL/TSPL string building is standard there too.

## 3. A4 invoices (PDF)

- **Puppeteer** (recommended) — renders the on-screen HTML/CSS invoice template to PDF with
  pixel-accurate output. Heavier (headless Chromium) but fine for on-demand, low-volume invoice
  generation from NestJS.
- **PDFKit** — lighter alternative if invoices are simple/programmatic and a Chromium dependency
  is undesirable; more code, less design flexibility.
- **pdf-lib** — best for post-processing (merging, stamping, filling existing PDF templates), not
  primary generation.

Trigger printing from Electron via native `webContents.print()` / `printToPDF` against the OS
print dialog (or silently to a configured default A4 printer) — not by round-tripping through
the browser's print CSS.

## 4. Recommended architecture: one print-agent per terminal

Centralize all device I/O in **one local print-agent process per terminal**, not in the frontend
and not in the backend:

- The Electron main process embeds the agent and exposes an internal IPC/HTTP API
  (`POST /print/receipt`, `/print/label`, `/print/invoice`) to the Next.js renderer.
- **NestJS never touches hardware.** It only generates the payload (formatted ESC/POS commands, a
  ZPL string, or a PDF buffer) and returns it; the local agent dispatches it to the correct
  configured device.
- Printer configuration lives in a local file on the machine
  (`%APPDATA%/onepos/printers.json`) — keyed by terminal, not by user login. See
  [`04-configuration.md`](./04-configuration.md).
- If a future bare-browser terminal (no Electron) is needed, deploy the same agent core as a
  small local Windows service exposed over localhost HTTP/websocket, rather than adopting QZ
  Tray — this keeps printer logic and configuration unified across both deployment modes instead
  of maintaining two separate printing code paths.
- **A printing failure must never block sale completion** — the sale commits to the database
  first; the print job is queued/retryable independently.

## Sources consulted

- node-thermal-printer (npm, GitHub: Klemen1337/node-thermal-printer)
- QZ Tray (qz.io) and its FAQ/wiki
- Web Serial API / WebUSB browser support trackers
- node-zpl (GitHub: ludwig-f/node-zpl); Zebra Browser Print integration docs (developer.zebra.com)
- PDF Generation in Node.js: Puppeteer vs PDFKit; Top JavaScript PDF generator libraries for 2026
- PrintNode use cases; Odoo POS ESC/POS Print Agent module (prior art for the print-agent pattern)
