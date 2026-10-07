"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, ExternalLink, X } from "lucide-react";
import { txUrl } from "@/lib/chain";

type Toast = { id: number; kind: "ok" | "error"; title: string; body?: string; hash?: string };
type Push = (t: Omit<Toast, "id">) => void;

const ToastContext = createContext<Push>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback<Push>(
    (t) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 6000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-toast px-4 py-3.5 text-white shadow-[0_12px_32px_-12px_rgba(27,31,40,0.5)] animate-[rise_.25s_ease-out]"
          >
            {t.kind === "ok" ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#7fe0a8]" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#ff9b93]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm break-words text-white/70">{t.body}</p>}
              {t.hash && (
                <a
                  href={txUrl(t.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-sm text-white underline underline-offset-2"
                >
                  View on explorer <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-white/50 hover:text-white" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
