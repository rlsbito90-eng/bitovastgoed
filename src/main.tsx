import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { installGlobalAppRecovery, markAppBootSuccessful } from "./lib/appRecovery";
import "./index.css";
import "./mobile-foundation.css";

globalThis.Buffer = globalThis.Buffer ?? Buffer;

installGlobalAppRecovery();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("App-root ontbreekt");

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

// Houd de herstelvergrendeling kort actief. Wanneer dezelfde asset direct na
// de cache-refresh opnieuw faalt, voorkomt dit een oneindige herlaadlus.
window.setTimeout(() => markAppBootSuccessful(), 8_000);
