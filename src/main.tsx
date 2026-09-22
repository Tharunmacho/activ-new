import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { syncLegacyTokenKeys } from "@/services/api";

// A browser that was open before the migration still holds a token under the
// old `adminToken` key. Reconciling the two keys before the first render keeps
// such a session alive instead of 401-ing it; without it the admin pages that
// read that key directly would send a stale value.
syncLegacyTokenKeys();

createRoot(document.getElementById("root")!).render(<App />);
