"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };

/**
 * Mantém a tela acesa enquanto o componente estiver montado (Screen Wake Lock
 * API — Safari 16.4+, Chrome Android). Em pé, com 30–60 s entre toques, sem
 * isso o celular bloqueia várias vezes por atendimento. Falha em silêncio
 * onde não há suporte; re-adquire ao voltar para a aba.
 */
export function useWakeLock(enabled = true) {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        if (sentinel.current && !sentinel.current.released) return;
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          s.release().catch(() => {});
          return;
        }
        sentinel.current = s;
      } catch {
        /* sem permissão / bateria baixa — segue sem wake lock */
      }
    };

    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [enabled]);
}

/**
 * true enquanto um input/textarea/select tem foco dentro de `ref`.
 * Usado para esconder barras fixas enquanto o teclado virtual está aberto
 * (no iOS Safari o teclado sobrepõe a viewport e `position: fixed` flutua
 * no meio da tela).
 */
export function useKeyboardOpen(ref: React.RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current ?? document.body;
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") &&
      !["checkbox", "radio", "date", "time", "file"].includes(
        (t as HTMLInputElement).type
      );
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) setOpen(true);
    };
    const onOut = () => {
      // pequeno atraso: ao pular de um campo para outro não pisca
      window.setTimeout(() => {
        if (!isField(document.activeElement)) setOpen(false);
      }, 60);
    };
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    return () => {
      el.removeEventListener("focusin", onIn);
      el.removeEventListener("focusout", onOut);
    };
  }, [ref]);
  return open;
}

/** Estado online/offline do navegador. */
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
}

const noopSubscribe = () => () => {};
/** true só depois da hidratação no cliente (sem setState em effect). */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Vibração curta onde existir (Android). No iOS é no-op. */
export function haptic(ms = 12) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}

/** Executa uma promise com timeout (ms). */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error("timeout")),
      ms
    );
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}
