# LiveTex

A live-reloading PDF viewer built with **Bun**, **React 19**, and **Tailwind CSS v4**.

Point it at a directory of PDF files and view them in a clean, dark-themed tabbed interface. When files are added, removed, or modified on disk the UI updates in real time — no manual refresh needed.

## Features

- **Live reload** — File-system watcher + WebSocket push keeps the viewer in sync with the PDF directory.
- **Tabbed navigation** — Horizontally scrollable tab bar for quick switching between PDFs.
- **Zero config** — Drop PDFs into the default `./pdfs` folder and go.
- **Configurable directory** — Set the watched folder via CLI argument or `PDF_DIR` env var.
- **Production build** — One-command optimised bundle with minification and source maps.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3+ installed.

### Install & Run

```bash
# Install dependencies
bun install

# Start the dev server (watches ./pdfs by default)
bun dev

# Or specify a custom PDF directory
bun dev /path/to/your/pdfs
```

## API

| Endpoint         | Method    | Description                                                                                      |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `/api/pdfs`      | GET       | Returns JSON list of PDF files and the watched directory path.                                   |
| `/api/pdf/:name` | GET       | Serves a single PDF file by name.                                                                |
| `/ws`            | WebSocket | Real-time events: `pdfs-updated` (file list changed) and `pdf-changed` (specific file modified). |

## Configuration

| Method               | Example                     |
| -------------------- | --------------------------- |
| CLI argument         | `bun dev ./my-pdfs`         |
| Environment variable | `PDF_DIR=./my-pdfs bun dev` |
| Default              | `./pdfs`                    |
