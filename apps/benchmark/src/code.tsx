import React from "react";
import { hydrateRoot } from "react-dom/client";
import type { HighlightedCode } from "@elide/ui/components/shiki";
import { CodeApp } from "./CodeApp";
import "./style.css";

// Build-time highlighting, serialized by the prerender step (like an island's props).
const data = document.getElementById("code-data")?.textContent;
const highlighted = data ? (JSON.parse(data) as HighlightedCode) : undefined;
hydrateRoot(document.getElementById("root")!, <CodeApp highlighted={highlighted} />);
