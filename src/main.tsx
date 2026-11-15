import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import { isCrmSandboxHost } from "./demo/demoHost";
import "./index.css";
import "./mobile-foundation.css";
import "./mobile-polish.css";
import "./mobile-acquisitie-fixes.css";
import "./mobile-vastgoedkansen-compact.css";
import "./mobile-pandenverkenner-card-selection.css";
import "./mobile-pandenverkenner-selection-state.css";
import "./quick-task-glass.css";
import "./pwa-gesture-guards.css";

globalThis.Buffer = globalThis.Buffer ?? Buffer;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("App-root ontbreekt");
const root = createRoot(rootElement);

async function startBito() {
  if (isCrmSandboxHost(window.location.hostname)) {
    // Build-time imports van App, Supabase Auth en de productie-DataStore
    // worden op dit demo-adres NIET geladen. Geen productiequeries of writes.
    // Voorheen aangemaakte PWA-serviceworkers mogen geen oude CRM-code cachen.
    if ("serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      } catch {
        // Afmelden is best effort; de demo blijft volledig backendvrij.
      }
    }
    const { default: CrmSandboxApp } = await import("./demo/CrmSandboxApp");
    root.render(<CrmSandboxApp />);
    return;
  }

  // Alle andere hosts blijven exact de bestaande beveiligde CRM laden.
  const [
    { default: App }, { default: AppErrorBoundary },
    { installGlobalAppRecovery, markAppBootSuccessful },
    { installPandenverkennerMobileCardSelection },
    { installPandenverkennerRenderedListSync },
    { registerBitoServiceWorker },
  ] = await Promise.all([
    import("./App.tsx"),
    import("./components/AppErrorBoundary"),
    import("./lib/appRecovery"),
    import("./lib/bag/pandenverkennerMobileCardSelection"),
    import("./lib/bag/pandenverkennerRenderedListSync"),
    import("./lib/pwa/serviceWorker"),
  ]);
  installGlobalAppRecovery();
  installPandenverkennerMobileCardSelection();
  installPandenverkennerRenderedListSync();
  void registerBitoServiceWorker();

  root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
  window.setTimeout(() => markAppBootSuccessful(), 8_000);
}

void startBito().catch(() => {
  rootElement.textContent = "De applicatie kon niet worden geladen. Vernieuw de pagina.";
});
