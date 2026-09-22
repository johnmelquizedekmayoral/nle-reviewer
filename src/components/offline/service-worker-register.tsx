"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.location.pathname.startsWith("/workspace") || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let reloading = false;

    async function checkForUpdate() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await registration.update();
        const response = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        const { version } = await response.json() as { version: string };
        const previous = window.localStorage.getItem("nle-deployment-version");
        window.localStorage.setItem("nle-deployment-version", version);

        if (!cancelled && previous && previous !== version) {
          reloading = true;
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          const names = await caches.keys();
          await Promise.all(names.filter((name) => name.startsWith("nle-")).map((name) => caches.delete(name)));
          window.location.reload();
        }
      } catch {
        // Offline startup should continue using the installed application shell.
      }
    }

    const handleControllerChange = () => {
      if (!cancelled && !reloading) { reloading = true; window.location.reload(); }
    };
    const handleVisibility = () => { if (document.visibilityState === "visible") void checkForUpdate(); };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(checkForUpdate, 60_000);
    void checkForUpdate();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
  return null;
}
