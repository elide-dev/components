import React from "react";
import { hydrateRoot } from "react-dom/client";
import { PerformanceApp } from "./PerformanceApp";
import "./style.css";
import "./performance.css";

hydrateRoot(document.getElementById("root")!, <PerformanceApp />);
