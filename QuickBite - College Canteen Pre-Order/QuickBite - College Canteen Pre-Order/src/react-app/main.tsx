import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import ErrorBoundary from "./ErrorBoundary";

// Global error handlers - surface uncaught errors to the page for debugging
window.addEventListener("error", (ev) => {
  // eslint-disable-next-line no-console
  console.error("Global error:", ev.error || ev.message, ev);
});
window.addEventListener("unhandledrejection", (ev) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", ev.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
