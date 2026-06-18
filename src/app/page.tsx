import { Suspense } from "react";
import ExploreMap from "@/components/explore/ExploreMap";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ExploreMap />
    </Suspense>
  );
}
