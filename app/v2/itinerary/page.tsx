import { Suspense } from "react";
import ItineraryContent from "./ItineraryContent";

export default function V2ItineraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center py-16">
          <div className="w-10 h-10 border-4 border-om-coral border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-om-muted font-semibold">Chargement...</p>
        </div>
      }
    >
      <ItineraryContent />
    </Suspense>
  );
}
