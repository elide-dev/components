import React from "react";
import { hydrateRoot } from "react-dom/client";
import { CodeApp } from "./CodeApp";
import "./style.css";
hydrateRoot(document.getElementById("root")!, <CodeApp />);
