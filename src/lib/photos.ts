import type { SupabaseClient } from "@supabase/supabase-js";

/** Bucket privado já usado pelos documentos; a foto fica em <patientId>/foto/. */
export const PHOTO_BUCKET = "documentos";
const SIGNED_TTL_SECONDS = 60 * 60; // 1h

export function photoPathFor(patientId: string) {
  return `${patientId}/foto/${Date.now()}.jpg`;
}

/**
 * Gera URLs assinadas para várias fotos numa única chamada.
 * Retorna um mapa photo_path → url (paths nulos/ausentes são ignorados).
 * Funciona no servidor e no cliente.
 */
export async function signPhotoUrls(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  try {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(unique, SIGNED_TTL_SECONDS);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) map.set(item.path, item.signedUrl);
    }
  } catch {
    /* sem foto é melhor que tela quebrada */
  }
  return map;
}

/**
 * Reduz a imagem no próprio celular (máx. `max` px no lado maior) e converte
 * para JPEG — upload rápido na rede da clínica e armazenamento pequeno.
 * Se o navegador não conseguir decodificar (ex.: HEIC), devolve o arquivo original.
 */
export async function resizeImage(file: File, max = 640, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
