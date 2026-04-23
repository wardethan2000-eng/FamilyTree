"use client";

import { useEffect, type ReactNode } from "react";

export function ElderShell({ token, children }: { token: string; children: ReactNode }) {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = `/elder/${encodeURIComponent(token)}/manifest.webmanifest`;
    document.head.appendChild(link);

    let appleIcon: HTMLLinkElement | null = null;
    appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = "/elder-icon-192.png";
    document.head.appendChild(appleIcon);

    const ac = document.createElement("meta");
    ac.name = "apple-mobile-web-app-capable";
    ac.content = "yes";
    document.head.appendChild(ac);

    const acStatus = document.createElement("meta");
    acStatus.name = "apple-mobile-web-app-status-bar-style";
    acStatus.content = "default";
    document.head.appendChild(acStatus);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/elder-sw.js", { scope: "/elder/" })
        .catch(() => {});
    }

    return () => {
      link.remove();
      appleIcon?.remove();
      ac.remove();
      acStatus.remove();
    };
  }, [token]);

  return <>{children}</>;
}
