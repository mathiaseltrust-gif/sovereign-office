import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Chrome keeps a very sticky per-origin favicon cache. Replace every favicon link
// at runtime and give the Tribe seal a fresh URL on each app boot so the tab cannot
// fall back to the historical orange placeholder.
for (const icon of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'))) {
  icon.remove();
}
const tribeIcon = document.createElement("link");
tribeIcon.rel = "icon";
tribeIcon.type = "image/png";
tribeIcon.href = `${import.meta.env.BASE_URL}tribal-seal.png?live=${Date.now()}`;
document.head.appendChild(tribeIcon);

createRoot(document.getElementById("root")!).render(<App />);
