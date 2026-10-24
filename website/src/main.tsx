import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// After index.css: the dark-mode remap ties with the Tailwind utilities it replaces and must come later.
import "./styles/app-dark.css";
import { syncLegacyTokenKeys } from "@/services/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// A browser that was open before the migration still holds a token under the
// old `adminToken` key. Reconciling the two keys before the first render keeps
// such a session alive instead of 401-ing it; without it the admin pages that
// read that key directly would send a stale value.
syncLegacyTokenKeys();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary label="Application"><App /></ErrorBoundary>
);
