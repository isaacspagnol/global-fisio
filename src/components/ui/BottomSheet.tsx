"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

let lockCount = 0;
let savedScrollY = 0;
let savedPath = "";

/**
 * Trava o scroll do fundo de um jeito que funciona no iOS Safari
 * (`overflow: hidden` no body não basta lá): fixa o body na posição atual
 * e restaura ao destravar. Suporta sheets aninhados via contador.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  const body = document.body;
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    savedPath = window.location.pathname;
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }
  lockCount += 1;
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      // se um link dentro do sheet navegou, não "devolve" o scroll na tela nova
      if (window.location.pathname === savedPath) window.scrollTo(0, savedScrollY);
    }
  };
}

/**
 * Bottom sheet mobile-first: sobe do rodapé no celular e vira um diálogo
 * centralizado em telas largas. Fecha ao tocar fora ou com Esc, trava o
 * scroll do fundo e respeita a área segura do iPhone.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** Altura máxima no mobile (default 90dvh). */
  tall = false,
  /** Alinha o cabeçalho com um botão/ação extra à direita. */
  headerAction,
  /** Desktop: largura máxima do diálogo. */
  size = "md",
  /** Scroll do conteúdo (ex.: esconder o teclado ao rolar). */
  onScroll,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tall?: boolean;
  headerAction?: React.ReactNode;
  size?: "md" | "lg";
  onScroll?: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // onClose costuma ser inline no pai: fica num ref para o effect depender só de `open`
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    // foco entra no painel (leitores de tela / teclado)
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-sheet-close]), [tabindex="0"]'
      );
      (first ?? panelRef.current)?.focus?.({ preventScroll: true });
    }, 30);
    return () => {
      window.clearTimeout(t);
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="anim-fade-in absolute inset-0 bg-black/45 dark:bg-black/60"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`anim-sheet-in relative flex flex-col bg-surface text-fg shadow-sheet rounded-t-3xl md:rounded-3xl w-full outline-none ${
          size === "lg" ? "md:max-w-2xl" : "md:max-w-md"
        } ${tall ? "max-h-[92dvh]" : "max-h-[88dvh]"} md:max-h-[85dvh]`}
        style={{ overscrollBehavior: "contain" }}
      >
        {/* alça */}
        <div className="md:hidden pt-2.5 pb-1 flex justify-center">
          <span className="w-10 h-1.5 rounded-full bg-line-strong" />
        </div>
        {(title || headerAction) && (
          <div className="flex items-center gap-2 pl-5 pr-2 pt-1 pb-2 md:pt-4">
            {title && (
              <h2
                id={titleId}
                className="flex-1 text-base font-semibold truncate"
              >
                {title}
              </h2>
            )}
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              data-sheet-close
              className="w-11 h-11 flex items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 active:bg-surface-3"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 [overscroll-behavior:contain]"
          onScroll={onScroll}
        >
          {children}
        </div>
        {footer && (
          <div className="border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-5 bg-surface rounded-b-none md:rounded-b-3xl">
            {footer}
          </div>
        )}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>
  );
}
