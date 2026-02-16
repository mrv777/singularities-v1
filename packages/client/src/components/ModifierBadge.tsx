import { useModifier } from "@/hooks/useModifier";
import { useUIStore } from "@/stores/ui";
import { Zap } from "lucide-react";

export function ModifierBadge() {
  const { data } = useModifier();
  const openModal = useUIStore((s) => s.openModal);

  if (!data?.modifier) return null;

  const { modifier } = data;
  const isMajor = modifier.severity === "major";

  return (
    <button
      onClick={() => openModal("modifier_detail")}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
        isMajor
          ? "border-cyber-amber/50 text-cyber-amber hover:border-cyber-amber bg-cyber-amber/5"
          : "border-cyber-cyan/30 text-cyber-cyan hover:border-cyber-cyan bg-cyber-cyan/5"
      }`}
      title={modifier.description}
    >
      <Zap size={10} />
      <span className="hidden lg:inline">{modifier.name}</span>
      <span className="lg:hidden">{isMajor ? "!" : "~"}</span>
    </button>
  );
}
