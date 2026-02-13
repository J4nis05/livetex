import { serve } from "bun";
import index from "./index.html";
import { readdirSync, statSync, mkdirSync, watch } from "fs";
import { join, resolve } from "path";

const PDF_DIR = process.argv[2] || process.env.PDF_DIR || "./pdfs";

mkdirSync(PDF_DIR, { recursive: true });

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

const clients = new Set<WebSocket>();

function broadcastPdfs() {
  const files = listPdfs();
  const msg = JSON.stringify({ type: "pdfs-updated", files });
  clients.forEach(ws => ws.send(msg));
}

watch(PDF_DIR, (event, filename) => {
  if (filename?.endsWith(".pdf")) {
    console.log(`[watch] ${event}: ${filename}`);
    broadcastPdfs();
    clients.forEach(ws => {
      ws.send(JSON.stringify({ type: "pdf-changed", name: filename }));
    });
  }
});

const server = serve({
  routes: {
    "/*": index,

    "/api/pdfs": {
      GET() {
        return Response.json({ files: listPdfs(), watchedDir: resolve(PDF_DIR) });
      },
    },

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

    "/ws": (req) => {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    },
  },

  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`PDF Viewer running at ${server.url}`);
console.log(`Watching PDF directory: ${PDF_DIR}`);
