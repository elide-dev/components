import React from "react";
import { hydrateRoot } from "react-dom/client";
import { PlatformApp } from "./PlatformApp";
import "./style.css";
hydrateRoot(document.getElementById("root")!, <PlatformApp />);
