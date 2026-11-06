import React from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nApp } from "./I18nApp";
import "./style.css";
hydrateRoot(document.getElementById("root")!, <I18nApp />);
