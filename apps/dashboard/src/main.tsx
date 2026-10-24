import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Landing } from "./Landing";
import "./style.css";

// Two pages, no router: the landing page at "/", the dashboard everywhere else (e.g. "/app").
const page = window.location.pathname === "/" ? <Landing /> : <App />;

createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);
