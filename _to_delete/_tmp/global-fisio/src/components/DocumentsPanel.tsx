"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOC_CATEGORIES, type PatientDocument } from "@/lib/types";
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

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
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("exame");
  const [preview, setPreview] = useState<{
    doc: PatientDocument;
    url: string;
  } | null>(null);

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
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${patientId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file);
      if (upErr) continue;
      await supabase.from("documents").insert({
        patient_id: patientId,
        name: file.name,
        category,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }
    e.target.value = "";
    setUploading(false);
    load();
  }

  async function openPreview(doc: PatientDocument) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (data?.signedUrl) setPreview({ doc, url: data.signedUrl });
  }

  async function handleDelete(doc: PatientDocument) {
    if (!confirm(`Excluir "${doc.name}"?`)) return;
    const supabase = createClient();
    await supabase.storage.from("documentos").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    load();
  }

  const isImage = (d: PatientDocument) =>
    d.mime_type?.startsWith("image/") ?? false;
  const isPdf = (d: PatientDocument) => d.mime_type === "application/pdf";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2 cursor-pointer transition">
          {uploading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Upload size={15} />
          )}
          {uploading ? "Enviando..." : "Enviar arquivo"}
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
        <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          Nenhum documento enviado ainda.
        </p>
      ) : (
        <ul
          className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}
        >
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-50 text-brand flex items-center justify-center shrink-0">
                {isImage(d) ? <ImageIcon size={17} /> : <FileText size={17} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-[11px] text-gray-500">
                  {DOC_CATEGORIES[d.category]}
                  {d.size_bytes ? ` · ${formatBytes(d.size_bytes)}` : ""}
                </p>
              </div>
              <button
                onClick={() => openPreview(d)}
                title="Visualizar"
                className="p-2 text-gray-500 hover:text-brand transition"
              >
                <Eye size={16} />
              </button>
              {!compact && (
                <button
                  onClick={() => handleDelete(d)}
                  title="Excluir"
                  className="p-2 text-gray-400 hover:text-red-600 transition"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium truncate">{preview.doc.name}</p>
              <div className="flex items-center gap-1">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand hover:underline px-2"
                >
                  Abrir em nova aba
                </a>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-900"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-[300px]">
              {isImage(preview.doc) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview.url}
                  alt={preview.doc.name}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : isPdf(preview.doc) ? (
                <iframe
                  src={preview.url}
                  className="w-full h-[80vh]"
                  title={preview.doc.name}
                />
              ) : (
                <div className="text-center p-8">
                  <p className="text-sm text-gray-600 mb-3">
                    Pré-visualização não disponível para este tipo de arquivo.
                  </p>
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand hover:underline font-medium"
                  >
                    Baixar arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
