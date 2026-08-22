import { createClient } from "@/lib/supabase/server";
import ExercisesClient from "./ExercisesClient";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .order("category")
    .order("name");

  return <ExercisesClient initial={(data ?? []) as Exercise[]} />;
}
