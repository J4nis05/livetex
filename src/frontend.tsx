/**
 * frontend.tsx — Client-side entry point for the LiveTex React application.
 *
 * This module is loaded by `src/index.html` as a `<script type="module">`.
 * It bootstraps React 19 by creating a root and rendering the top-level
 * `<App />` component into the `#root` DOM element.
 *
 * If the DOM is still loading when this script runs, rendering is deferred
 * until `DOMContentLoaded` fires; otherwise it starts immediately.
 */

import { createRoot } from "react-dom/client";
import { App } from "./App";

/** Create a React root and mount the application. */
function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
