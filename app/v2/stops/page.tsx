import { Suspense } from "react";
import StopsContent from "./StopsContent";

export default function V2StopsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center py-16">
          <div className="w-8 h-8 border-3 border-om-coral border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-om-muted text-sm font-semibold">Chargement...</p>
        </div>
      }
    >
      <StopsContent />
    </Suspense>
  );
}
