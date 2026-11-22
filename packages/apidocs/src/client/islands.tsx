/**
 * The static site's client bundle (assets/apidocs.js): the behaviors in behaviors.tsx over prerendered pages,
 * started once per page load. Classic script, no modules, no fetch: the search index is a script that assigns
 * window.apidocsSearch, loaded on first use. Astro pages use src/astro/client.ts instead.
 */
import { leaving, navigatorScroll, pageBehaviors, searchBox } from "./behaviors";

function start() {
  document.documentElement.dataset.js = "";
  pageBehaviors();
  searchBox();
  navigatorScroll();
  leaving();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
