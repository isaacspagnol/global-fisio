import { createClient } from "@/lib/supabase/server";
import PerfilClient from "./PerfilClient";
import type { TherapistProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("therapist_profile")
    .select("*")
    .order("created_at")
    .limit(1);

  const profile = (data?.[0] ?? null) as TherapistProfile | null;

  return <PerfilClient profile={profile} />;
}
