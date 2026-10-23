"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";

export type ToastKind = "success" | "info" | "error";

export type ToastOptions = {
  kind?: ToastKind;
  /** Texto do botão de ação (ex.: "Desfazer"). */
  actionLabel?: string;
  onAction?: () => void;
  /** ms até sumir sozinho. Default 4000 (6000 quando há ação). */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; message: string };

type Ctx = {
  toast: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  // Fora do provider (ex.: testes isolados) vira no-op em vez de quebrar.
  return (
    ctx ?? {
      toast: () => 0,
      dismiss: () => {},
    }
  );
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = ++toastId;
      const duration = opts.duration ?? (opts.actionLabel ? 6000 : 4000);
      // Mantém no máximo 2 visíveis
      setItems((prev) => [...prev.slice(-1), { id, message, ...opts }]);
      const t = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, t);
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Fica acima da tab bar / barra de ação, dentro da área segura */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[70] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="anim-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-fg text-bg shadow-card px-4 py-3 dark:bg-surface-3 dark:text-fg"
          >
            <span className="shrink-0">
              {t.kind === "error" ? (
                <TriangleAlert size={18} className="text-danger" />
              ) : t.kind === "info" ? (
                <Info size={18} />
              ) : (
                <Check size={18} className="text-success" />
              )}
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">
              {t.message}
            </p>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                className="shrink-0 h-9 px-3 rounded-lg text-sm font-semibold text-accent-strong dark:text-accent active:opacity-70"
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => dismiss(t.id)}
              className="shrink-0 w-9 h-9 -mr-2 flex items-center justify-center rounded-lg opacity-70 active:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
