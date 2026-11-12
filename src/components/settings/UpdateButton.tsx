import { useEffect, useRef, useState } from "react";
export function UpdateButton() {
  const [state, setState] = useState("Check for app updates");
  const [reload, setReload] = useState(false);
  const mounted = useRef(true);
  const cleanup = useRef<(() => void)[]>([]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cleanup.current.forEach((fn) => fn());
    };
  }, []);
  const check = async () => {
    if (import.meta.env.DEV) {
      setState("Updates apply after publishing");
      return;
    }
    if (!navigator.onLine) {
      setState("Connect to check for updates");
      return;
    }
    setState("Checking…");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw Error("Not registered");
      await registration.update();
      if (!mounted.current) return;
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        setState("Reload latest app");
        setReload(true);
        return;
      }
      const change = () => {
        if (!mounted.current) return;
        if (worker.state === "activated") {
          setState("Reload latest app");
          setReload(true);
        } else if (worker.state === "redundant")
          setState("Update failed · try again");
        else setState("Downloading update…");
      };
      worker.addEventListener("statechange", change);
      cleanup.current.push(() =>
        worker.removeEventListener("statechange", change),
      );
      change();
    } catch {
      if (mounted.current) setState("Update unavailable · try again");
    }
  };
  return (
    <button
      className="update-app"
      onClick={() => (reload ? location.reload() : void check())}
    >
      {state}
    </button>
  );
}
