import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:pl-60 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
