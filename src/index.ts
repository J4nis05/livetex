/**
 * LiveTex — Backend Server
 *
 * This is the main entry point for the LiveTex application. It spins up a Bun
 * HTTP server that:
 *   1. Serves the React frontend (via the HTML entrypoint).
 *   2. Exposes a REST API for listing and fetching PDF files.
 *   3. Watches a configurable PDF directory on disk and pushes real-time
 *      update notifications to all connected clients over WebSocket.
 *
 * The PDF directory can be configured via:
 *   - CLI argument:        `bun dev ./my-pdfs`
 *   - Environment variable: `PDF_DIR=./my-pdfs bun dev`
 *   - Falls back to `./pdfs` if neither is provided.
 */

import { serve } from "bun";
import index from "./index.html";
import { readdirSync, statSync, mkdirSync, watch } from "fs";
import { join, resolve } from "path";

/**
 * Resolve the PDF directory from CLI args, env var, or default ("./pdfs").
 * The directory is created automatically if it doesn't already exist.
 */
const PDF_DIR = process.argv[2] || process.env.PDF_DIR || "./pdfs";

mkdirSync(PDF_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

/**
 * Scans `PDF_DIR` and returns metadata for every `.pdf` file found,
 * sorted alphabetically by name.
 *
 * @returns An array of objects containing the file `name`, absolute `path`,
 *          and last-`modified` timestamp (in ms).
 */
function listPdfs(): { name: string; path: string; modified: number }[] {
  try {
    const files = readdirSync(PDF_DIR);
    return files
      .filter(f => f.endsWith(".pdf"))
      .map(name => {
        const fullPath = join(PDF_DIR, name);
        const stat = statSync(fullPath);
        return {
          name,
          path: fullPath,
          modified: stat.mtimeMs,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WebSocket client tracking
// ---------------------------------------------------------------------------

/** Active WebSocket connections. Used to broadcast real-time PDF updates. */
const clients = new Set<WebSocket>();

/**
 * Sends the current list of PDF files to every connected WebSocket client
 * as a `pdfs-updated` message.
 */
function broadcastPdfs() {
  const files = listPdfs();
  const msg = JSON.stringify({ type: "pdfs-updated", files });
  clients.forEach(ws => ws.send(msg));
}

// ---------------------------------------------------------------------------
// File system watcher
// ---------------------------------------------------------------------------

/**
 * Watches `PDF_DIR` for file-system events. When a `.pdf` file is added,
 * removed, or modified the server:
 *   - Broadcasts the full updated file list (`pdfs-updated`).
 *   - Sends a targeted `pdf-changed` event so the frontend can refresh
 *     an already-open PDF in-place.
 */
watch(PDF_DIR, (event, filename) => {
  if (filename?.endsWith(".pdf")) {
    console.log(`[watch] ${event}: ${filename}`);
    broadcastPdfs();
    clients.forEach(ws => {
      ws.send(JSON.stringify({ type: "pdf-changed", name: filename }));
    });
  }
});

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const server = serve({
  routes: {
    /** Catch-all: serve the React SPA for any non-API route. */
    "/*": index,

    /**
     * GET /api/pdfs
     * Returns a JSON object with:
     *   - `files`     – array of PDF metadata (name, path, modified).
     *   - `watchedDir` – the resolved absolute path of the watched directory.
     */
    "/api/pdfs": {
      GET() {
        return Response.json({ files: listPdfs(), watchedDir: resolve(PDF_DIR) });
      },
    },

    /**
     * GET /api/pdf/:name
     * Serves a single PDF file by name. Includes basic path-traversal
     * protection (rejects names containing `/` or `..`).
     */
    "/api/pdf/:name": async (req) => {
      const name = decodeURIComponent(req.params.name);
      if (!name.endsWith(".pdf") || name.includes("/") || name.includes("..")) {
        console.log(`[serve] Rejected invalid file request: ${name}`);
        return new Response("Invalid file", { status: 400 });
      }
      const filePath = join(PDF_DIR, name);
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.log(`[serve] File not found: ${name}`);
        return new Response("Not found", { status: 404 });
      }
      console.log(`[serve] Serving PDF to client: ${name}`);
      return new Response(file, {
        headers: { "Content-Type": "application/pdf" },
      });
    },

    /** Upgrade HTTP requests on `/ws` to WebSocket connections. */
    "/ws": (req) => {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    },
  },

  /** WebSocket lifecycle handlers — track connected clients. */
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
  },

  /**
   * In development mode, enable Bun's built-in Hot Module Replacement (HMR)
   * and enhanced console output.
   */
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`PDF Viewer running at ${server.url}`);
console.log(`Watching PDF directory: ${PDF_DIR}`);
