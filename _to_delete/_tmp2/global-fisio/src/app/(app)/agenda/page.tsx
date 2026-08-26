import { createClient } from "@/lib/supabase/server";
import AgendaClient from "./AgendaClient";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .neq("status", "inativo")
    .order("full_name");

  return <AgendaClient patients={(data ?? []) as Patient[]} />;
}
