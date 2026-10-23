"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOC_CATEGORIES, type PatientDocument } from "@/lib/types";
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Skeleton,
  useToast,
} from "@/components/ui";
import { lockBodyScroll } from "@/components/ui/BottomSheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPanel({
  patientId,
  compact = false,
}: {
  patientId: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("exame");
  const [preview, setPreview] = useState<{ doc: PatientDocument; url: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PatientDocument | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as PatientDocument[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    // busca inicial/recarga; o setState acontece após o await (assíncrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!preview) return;
    return lockBodyScroll();
  }, [preview]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    let ok = 0;

    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${patientId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file);
      if (upErr) continue;
      const { error } = await supabase.from("documents").insert({
        patient_id: patientId,
        name: file.name,
        category,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (!error) ok += 1;
    }
    e.target.value = "";
    setUploading(false);
    if (ok === 0) toast("Falha ao enviar o arquivo.", { kind: "error" });
    else toast(`${ok} arquivo${ok === 1 ? "" : "s"} enviado${ok === 1 ? "" : "s"}.`);
    load();
  }

  async function openPreview(doc: PatientDocument) {
    setOpening(doc.id);
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60 * 10);
    setOpening(null);
    if (data?.signedUrl) setPreview({ doc, url: data.signedUrl });
    else toast("Não foi possível abrir o documento.", { kind: "error" });
  }

  async function handleDelete(doc: PatientDocument) {
    const supabase = createClient();
    await supabase.storage.from("documentos").remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    setToDelete(null);
    if (error) toast("Não foi possível excluir.", { kind: "error" });
    else toast("Documento excluído.");
    load();
  }

  const isImage = (d: PatientDocument) => d.mime_type?.startsWith("image/") ?? false;
  const isPdf = (d: PatientDocument) => d.mime_type === "application/pdf";

  return (
    <div>
      {/* Envio: categoria em chips + botão */}
      <div className="mb-4 space-y-2">
        <ChipRow>
          {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
            <Chip key={k} active={category === k} onClick={() => setCategory(k)}>
              {v}
            </Chip>
          ))}
        </ChipRow>
        <label
          className={`inline-flex w-full md:w-auto h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold text-[15px] cursor-pointer transition-colors ${
            uploading
              ? "bg-surface-2 text-fg-muted"
              : "bg-accent-soft text-accent-soft-fg active:brightness-90"
          }`}
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {uploading ? "Enviando..." : `Enviar ${DOC_CATEGORIES[category].toLowerCase()}`}
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={22} />}
          title="Nenhum documento"
          description="Exames, raio-x e laudos enviados aqui ficam à mão durante o atendimento."
        />
      ) : (
        <ul className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface pl-3 pr-1 py-2 min-h-16"
            >
              <button
                type="button"
                onClick={() => openPreview(d)}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
                aria-label={`Visualizar ${d.name}`}
              >
                <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center shrink-0">
                  {opening === d.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isImage(d) ? (
                    <ImageIcon size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium truncate">{d.name}</span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <Badge>{DOC_CATEGORIES[d.category]}</Badge>
                    {d.size_bytes ? (
                      <span className="text-[11px] text-fg-muted tnum">{formatBytes(d.size_bytes)}</span>
                    ) : null}
                  </span>
                </span>
              </button>
              {!compact && (
                <button
                  type="button"
                  onClick={() => setToDelete(d)}
                  aria-label={`Excluir ${d.name}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-fg-faint hover:text-danger hover:bg-danger-soft/60 shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Visualizador em tela cheia */}
      {preview && (
        <div
          className="fixed inset-0 z-[80] bg-black flex flex-col anim-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={preview.doc.name}
        >
          <div className="flex items-center gap-2 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white bg-black/80">
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Fechar"
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20"
            >
              <X size={22} />
            </button>
            <p className="flex-1 text-sm font-medium truncate">{preview.doc.name}</p>
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir em nova aba"
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20"
            >
              <ExternalLink size={20} />
            </a>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center [overscroll-behavior:contain]">
            {isImage(preview.doc) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview.url}
                alt={preview.doc.name}
                className="max-w-full max-h-full object-contain"
              />
            ) : isPdf(preview.doc) ? (
              <iframe src={preview.url} className="w-full h-full bg-white" title={preview.doc.name} />
            ) : (
              <div className="text-center p-8 text-white">
                <p className="text-sm text-white/70 mb-4">
                  Pré-visualização não disponível para este tipo de arquivo.
                </p>
                <Button variant="secondary" onClick={() => window.open(preview.url, "_blank")}>
                  <ExternalLink size={16} /> Baixar arquivo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        title="Excluir documento?"
        description={toDelete ? `“${toDelete.name}” será apagado permanentemente.` : undefined}
      />
    </div>
  );
}
