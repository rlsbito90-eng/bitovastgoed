import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.tsx";
import "./index.css";

globalThis.Buffer = globalThis.Buffer ?? Buffer;

createRoot(document.getElementById("root")!).render(<App />);
