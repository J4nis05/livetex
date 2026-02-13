import { useEffect, useState, useRef } from "react";
import "./index.css";

interface PdfFile {
  name: string;
  path: string;
  modified: number;
}

export function App() {
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [watchedDir, setWatchedDir] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      nav.scrollLeft += e.deltaY;
    };
    nav.addEventListener("wheel", onWheel, { passive: false });
    return () => nav.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    fetch("/api/pdfs")
      .then(res => res.json())
      .then(data => {
        setPdfs(data.files || []);
        if (data.watchedDir) setWatchedDir(data.watchedDir);
        if (data.files?.length > 0 && !selectedPdf) {
          setSelectedPdf(data.files[0].name);
        }
      });

    const ws = new WebSocket(`ws://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "pdfs-updated") {
        setPdfs(msg.files);
        setSelectedPdf(current => {
          const stillExists = msg.files.some((f: PdfFile) => f.name === current);
          if (!stillExists) {
            return msg.files.length > 0 ? msg.files[0].name : null;
          }
          return current;
        });
      } else if (msg.type === "pdf-changed" && msg.name === selectedPdf) {
        setRefreshKey(k => k + 1);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-900 text-white">
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold">PDF Viewer</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <nav ref={navRef} className="min-w-0 w-full bg-gray-800 border-b border-gray-700 overflow-x-auto">
        <div className="flex gap-1 px-4 py-2">
          {pdfs.length === 0 && (
            <span className="text-gray-500 text-sm whitespace-nowrap">No PDF files found</span>
          )}
          {pdfs.map(pdf => (
            <button
              key={pdf.name}
              onClick={() => setSelectedPdf(pdf.name)}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-t text-sm font-medium transition-colors ${
                selectedPdf === pdf.name
                  ? 'bg-gray-700 text-white border-t-2 border-blue-500'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {pdf.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 flex justify-center bg-gray-900 overflow-hidden">
        <div className="w-full h-full">
          {selectedPdf ? (
            <iframe
              key={`${selectedPdf}-${refreshKey}`}
              ref={iframeRef}
              src={`/api/pdf/${encodeURIComponent(selectedPdf)}`}
              className="w-full h-full border-none"
              title={selectedPdf}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>Place PDF files in the watched directory to view them here</p>
              <hr className="w-1/3 border-gray-700 my-2" />
              <p>Full watched path: <code>{watchedDir || 'unknown'}</code></p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
