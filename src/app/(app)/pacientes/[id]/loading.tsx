import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando ficha do paciente">
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 flex-1" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
      <Skeleton className="h-40 rounded-2xl mb-3" />
      <Skeleton className="h-32 rounded-2xl mb-3" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
