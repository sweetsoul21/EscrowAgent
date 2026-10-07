"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** While a transaction is pending the dialog can't be dismissed by accident. */
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[460px] rounded-[28px] bg-paper p-0 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-[rise_.2s_ease-out]"
    >
      <div className="p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
          {!locked && (
            <button
              onClick={onClose}
              className="-m-1 rounded-full p-1 text-muted hover:bg-mist hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}
