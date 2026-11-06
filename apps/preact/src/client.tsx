import { createRoot, hydrateRoot } from "react-dom/client";
import { Consumer } from "./consumer";
import "../../benchmark/src/style.css";

const root = document.getElementById("root")!;
const app = <Consumer platform={location.pathname.startsWith("/platform")} />;
const mode = root.hasChildNodes() ? "hydrate" : "client";
if (mode === "hydrate") hydrateRoot(root, app);
else createRoot(root).render(app);
document.documentElement.dataset.renderMode = mode;
