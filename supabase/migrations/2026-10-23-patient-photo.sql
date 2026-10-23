-- Foto de perfil do paciente.
-- O arquivo fica no bucket privado "documentos" (pasta <patient_id>/foto/);
-- aqui guardamos só o caminho. Rode no SQL Editor do Supabase.

alter table public.patients
  add column if not exists photo_path text;
