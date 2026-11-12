import { useEffect, type ReactNode } from "react";
import { primeAudio, playSound, stopSounds } from "../../sound";
export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stopSounds();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stopSounds();
    };
  }, []);
  return (
    <div
      className="app-shell"
      onPointerDownCapture={(event) => {
        if (event.isTrusted) primeAudio();
      }}
      onKeyDownCapture={(event) => {
        if (event.isTrusted) primeAudio();
      }}
      onClickCapture={(event) => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const button = event.target.closest("button");
        if (
          button &&
          !button.disabled &&
          !button.matches(
            '[data-sound="off"],.square,.editSquare,.piecepalette button,.piece-suggestions button,.promotion button',
          )
        )
          playSound("tap");
      }}
    >
      {children}
    </div>
  );
}
