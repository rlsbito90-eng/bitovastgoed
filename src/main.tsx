import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { installGlobalAppRecovery, markAppBootSuccessful } from "./lib/appRecovery";
import { registerBitoServiceWorker } from "./lib/pwa/serviceWorker";
import "./index.css";
import "./mobile-foundation.css";
import "./mobile-polish.css";
import "./mobile-acquisitie-fixes.css";

globalThis.Buffer = globalThis.Buffer ?? Buffer;

installGlobalAppRecovery();
void registerBitoServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("App-root ontbreekt");

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

window.setTimeout(() => markAppBootSuccessful(), 8_000);
