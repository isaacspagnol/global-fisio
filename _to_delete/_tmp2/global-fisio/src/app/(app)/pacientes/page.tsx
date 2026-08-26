import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus, Search } from "lucide-react";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("*")
    .order("full_name");

  if (q) query = query.ilike("full_name", `%${q}%`);
  if (status && status !== "todos") query = query.eq("status", status);

  const { data } = await query;
  const patients = (data ?? []) as Patient[];

  const statusStyle: Record<string, string> = {
    ativo: "bg-green-50 text-green-700",
    alta: "bg-blue-50 text-blue-700",
    inativo: "bg-gray-100 text-gray-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {patients.length} paciente{patients.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/pacientes/novo"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
        >
          <Plus size={16} /> Novo paciente
        </Link>
      </div>

      <form className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? "todos"}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="alta">Alta</option>
          <option value="inativo">Inativos</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {patients.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">
            Nenhum paciente encontrado.{" "}
            <Link href="/pacientes/novo" className="text-brand hover:underline">
              Cadastrar o primeiro
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pacientes/${p.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-100 text-brand-dark flex items-center justify-center font-semibold text-sm shrink-0">
                    {p.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {p.diagnosis || "Sem diagnóstico registrado"}
                      {p.health_insurance ? ` · ${p.health_insurance}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${statusStyle[p.status]}`}
                  >
                    {p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
