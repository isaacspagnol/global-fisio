"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar, Button } from "@/components/ui";

export type PhotoChange =
  | { kind: "keep" }
  | { kind: "replace"; file: File }
  | { kind: "remove" };

/**
 * Foto de perfil do paciente: preview grande + "Trocar foto" / "Remover".
 * No celular o input abre a câmera ou a galeria; o upload acontece no submit
 * do formulário (o componente só informa a escolha via onChange).
 */
export default function PhotoPicker({
  name,
  currentUrl,
  onChange,
}: {
  name: string;
  currentUrl?: string | null;
  onChange: (change: PhotoChange) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // libera o blob: URL ao trocar/desmontar
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setPreview(url);
    onChange({ kind: "replace", file });
  }

  function remove() {
    setPreview(null);
    setObjectUrl(null);
    onChange({ kind: "remove" });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? "Trocar foto do paciente" : "Adicionar foto do paciente"}
        className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Avatar name={name || "?"} src={preview} size="xl" />
        <span className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-accent text-accent-fg border-2 border-surface flex items-center justify-center shadow-card">
          <Camera size={16} />
        </span>
      </button>
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-sm font-medium">Foto do paciente</p>
        <p className="text-xs text-fg-muted">
          Opcional. Aparece na lista, na ficha e no atendimento.
        </p>
        <div className="flex gap-2 mt-1">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera size={16} /> {preview ? "Trocar" : "Adicionar"}
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" onClick={remove} className="text-danger">
              <Trash2 size={16} /> Remover
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
