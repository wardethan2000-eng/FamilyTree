import { useCallback, useEffect, useState } from "preact/hooks";

export type Route =
  | { view: "home" }
  | { view: "person"; personId: string }
  | { view: "memory"; memoryId: string }
  | { view: "drift" }
  | { view: "search"; query: string }
  | { view: "section"; sectionId: string };

function parseHash(hash: string): Route {
  if (!hash || hash === "#" || hash === "#/") return { view: "home" };
  const path = hash.replace(/^#\/?/, "");
  if (path.startsWith("people/")) return { view: "person", personId: path.slice(7) };
  if (path.startsWith("memories/")) return { view: "memory", memoryId: path.slice(9) };
  if (path.startsWith("sections/")) return { view: "section", sectionId: path.slice(9) };
  if (path === "drift") return { view: "drift" };
  if (path.startsWith("search")) {
    const q = path.includes("?") ? new URLSearchParams(path.split("?")[1]).get("q") ?? "" : "";
    return { view: "search", query: q };
  }
  return { view: "home" };
}

function routeToHash(route: Route): string {
  switch (route.view) {
    case "home": return "#/";
    case "person": return `#/people/${route.personId}`;
    case "memory": return `#/memories/${route.memoryId}`;
    case "section": return `#/sections/${route.sectionId}`;
    case "drift": return "#/drift";
    case "search": return `#/search?q=${encodeURIComponent(route.query)}`;
  }
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((route: Route) => {
    window.location.hash = routeToHash(route);
  }, []);

  return { route, navigate };
}