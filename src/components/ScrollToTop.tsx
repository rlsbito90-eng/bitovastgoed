import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Scroll zowel window als de interne <main> container naar boven.
    // AppLayout.tsx gebruikt <main className="flex-1 overflow-y-auto">,
    // dus de eigenlijke scroll vindt daar plaats, niet op window.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname, search, hash]);

  return null;
}
