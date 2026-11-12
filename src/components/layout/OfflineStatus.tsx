import { useEffect, useState } from "react";
import { CloudDownload, WifiOff, CheckCircle2 } from "lucide-react";
export function OfflineStatus() {
  const [updateReady, setUpdateReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [state, setState] = useState<
    "preparing" | "ready" | "failed" | "development"
  >(!import.meta.env.DEV ? "preparing" : "development");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!!import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) {
      setState("failed");
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const cleanups: (() => void)[] = [];
    const ready = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      const expiry = window.setTimeout(() => {
        channel.port1.close();
        if (!cancelled) setState("failed");
      }, 120000);
      cleanups.push(() => {
        clearTimeout(expiry);
        channel.port1.close();
      });
      channel.port1.onmessage = (event) => {
        clearTimeout(expiry);
        channel.port1.close();
        if (!cancelled) {
          setState(event.data.ready ? "ready" : "failed");
          window.clearTimeout(timer);
        }
      };
      worker.postMessage(
        { type: attempt ? "PREPARE_OFFLINE" : "CHECK_OFFLINE" },
        [channel.port2],
      );
    };
    let hadController = !!navigator.serviceWorker.controller;
    const change = () => {
      if (navigator.serviceWorker.controller) {
        ready();
        if (hadController) setUpdateReady(true);
        hadController = true;
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", change);
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        if (registration.active && navigator.serviceWorker.controller) ready();
        const track = () => {
          const worker = registration.installing;
          if (!worker) return;
          const update = () => {
            if (worker.state === "activated") ready();
            if (
              worker.state === "redundant" &&
              !navigator.serviceWorker.controller
            )
              setState("failed");
          };
          worker.addEventListener("statechange", update);
          cleanups.push(() =>
            worker.removeEventListener("statechange", update),
          );
          update();
        };
        registration.addEventListener("updatefound", track);
        cleanups.push(() =>
          registration.removeEventListener("updatefound", track),
        );
        track();
        const update = () => {
          if (navigator.onLine && !document.hidden)
            registration.update().catch(() => {});
        };
        window.addEventListener("focus", update);
        document.addEventListener("visibilitychange", update);
        cleanups.push(() => {
          window.removeEventListener("focus", update);
          document.removeEventListener("visibilitychange", update);
        });
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    timer = window.setTimeout(() => {
      if (!cancelled)
        setState((current) => (current === "ready" ? current : "failed"));
    }, 120000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", change);
      cleanups.forEach((clean) => clean());
    };
  }, [attempt]);
  const label =
    state === "ready"
      ? online
        ? "Ready offline"
        : "Offline · ready"
      : state === "development"
        ? "Running on your device"
        : state === "failed"
          ? "Offline download incomplete"
          : "Preparing offline…";
  return (
    <div className="offline-status" role="status">
      {state === "ready" ? (
        online ? (
          <CheckCircle2 size={14} />
        ) : (
          <WifiOff size={14} />
        )
      ) : (
        <CloudDownload size={14} />
      )}
      <span>{updateReady ? "New version ready" : label}</span>
      {updateReady && (
        <button
          className="text-button update-link"
          onClick={() => location.reload()}
        >
          Reload app
        </button>
      )}
      {state === "failed" && (
        <button
          className="text-button"
          onClick={() => {
            setState("preparing");
            setAttempt((n) => n + 1);
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
