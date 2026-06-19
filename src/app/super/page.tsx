import { loadSuperWarren } from "@/lib/explore/repository";
import SuperWarrenMap from "@/components/explore/SuperWarrenMap";

export const metadata = {
  title: "Super Warren — how your journeys connect",
};

// The Super Warren meta-graph. Each saved warren is a node; warrens that share articles are
// linked. Computed server-side from saved warrens, then rendered with the Explore engine.
export default async function SuperWarrenPage() {
  const data = await loadSuperWarren();
  return <SuperWarrenMap data={data} />;
}
