"use client";

import { useEffect, useState } from "react";
import { isStandalone } from "@/components/push/pushClient";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const ua = window.navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <span className="text-xl">📲</span>
        <p className="flex-1 text-sm text-foreground">
          {isIOS ? (
            <>
              Add to your Home Screen: tap <strong>Share</strong> →{" "}
              <strong>Add to Home Screen</strong>. Then open it to enable alerts.
            </>
          ) : (
            <>Install this app from your browser menu to get it on your home screen.</>
          )}
        </p>
        <button onClick={() => setShow(false)} className="text-sm text-muted">
          Dismiss
        </button>
      </div>
    </div>
  );
}
