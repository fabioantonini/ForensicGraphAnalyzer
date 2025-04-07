import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setDefaultLanguage } from "./i18n"; // Import i18n configuration

// Force Italian language manually at startup
setDefaultLanguage();

createRoot(document.getElementById("root")!).render(<App />);
