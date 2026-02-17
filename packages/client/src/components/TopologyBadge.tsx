import { useTopology } from "@/hooks/useTopology";
import { useUIStore } from "@/stores/ui";
import { Globe } from "lucide-react";

export function TopologyBadge() {
  const { data } = useTopology();
  const openModal = useUIStore((s) => s.openModal);

  if (!data?.topology) return null;

  return (
    <button
      onClick={() => openModal("topology_detail")}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors border-teal-400/30 text-teal-400 hover:border-teal-400 bg-teal-400/5"
      title="Weekly grid shift — click for details"
    >
      <Globe size={10} />
      <span className="hidden lg:inline">Grid Shift</span>
      <span className="lg:hidden">GS</span>
    </button>
  );
}
