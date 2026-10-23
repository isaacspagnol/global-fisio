import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import type { Patient } from "@/lib/types";
import { signPhotoUrls } from "@/lib/photos";
import {
  Avatar,
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  LinkButton,
  PATIENT_STATUS,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "ativo", label: "Ativos" },
  { key: "alta", label: "Alta" },
  { key: "inativo", label: "Inativos" },
];

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "todos" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("patients").select("*").order("full_name");
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (status && status !== "todos") query = query.eq("status", status);

  const { data } = await query;
  const patients = (data ?? []) as Patient[];
  const photos = await signPhotoUrls(supabase, patients.map((p) => p.photo_path));

  const hrefFor = (s: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s !== "todos") p.set("status", s);
    const qs = p.toString();
    return `/pacientes${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${patients.length} paciente${patients.length === 1 ? "" : "s"}${
          status !== "todos" ? ` · ${FILTERS.find((f) => f.key === status)?.label.toLowerCase()}` : ""
        }`}
        action={
          <LinkButton href="/pacientes/novo" size="sm" className="hidden md:inline-flex">
            <Plus size={16} /> Novo paciente
          </LinkButton>
        }
      />

      {/* Busca: Enter/“Buscar” do teclado envia o formulário */}
      <form className="mb-3" role="search">
        {status !== "todos" && <input type="hidden" name="status" value={status} />}
        <label className="relative block">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            enterKeyHint="search"
            autoComplete="off"
            className="w-full h-12 rounded-xl border border-line-strong bg-surface pl-11 pr-3 text-base md:text-sm placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
      </form>

      <ChipRow className="mb-4">
        {FILTERS.map((f) => (
          <Chip key={f.key} href={hrefFor(f.key)} active={status === f.key}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={q ? `Nenhum paciente para “${q}”` : "Nenhum paciente por aqui"}
          description={
            q
              ? "Confira a grafia ou limpe o filtro de status."
              : "Cadastre o primeiro paciente para começar os atendimentos."
          }
          action={
            q ? (
              <LinkButton href="/pacientes" variant="secondary">
                Limpar busca
              </LinkButton>
            ) : (
              <LinkButton href="/pacientes/novo">
                <Plus size={18} /> Cadastrar paciente
              </LinkButton>
            )
          }
        />
      ) : (
        <Card as="ul" className="divide-y divide-line overflow-hidden">
          {patients.map((p) => {
            const st = PATIENT_STATUS[p.status] ?? PATIENT_STATUS.ativo;
            return (
              <li key={p.id}>
                <Link
                  href={`/pacientes/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 min-h-[68px] hover:bg-surface-2 active:bg-surface-3 transition-colors"
                >
                  <Avatar
                    name={p.full_name}
                    src={p.photo_path ? photos.get(p.photo_path) : null}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium truncate">
                      {p.full_name}
                    </span>
                    <span className="block text-xs text-fg-muted truncate mt-0.5">
                      {p.diagnosis || "Sem diagnóstico registrado"}
                      {p.health_insurance ? ` · ${p.health_insurance}` : ""}
                    </span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <ChevronRight size={18} className="text-fg-faint shrink-0 -mr-1" />
                </Link>
              </li>
            );
          })}
        </Card>
      )}

      <Fab href="/pacientes/novo" label="Novo paciente">
        <Plus size={22} /> Paciente
      </Fab>
    </div>
  );
}
