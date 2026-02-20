import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  ALL_MODULES,
  MODULE_CATEGORIES,
  MODULE_TIERS,
  TIER_UNLOCK_REQUIREMENT,
  type ModuleCategory,
  type ModuleTier,
  type ModuleDefinition,
  type PlayerModule,
} from "@singularities/shared";
import { ModuleCard } from "./ModuleCard";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { playSound } from "@/lib/sound";
import { useGameFeedback } from "@/hooks/useGameFeedback";
import { MODULE_PURCHASE_XP } from "@singularities/shared";

const CATEGORIES: ModuleCategory[] = ["primary", "secondary", "relay", "backup"];

export function TechTreeModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { player, setPlayer } = useAuthStore();
  const queryClient = useQueryClient();
  const { emitFloatNumber, emitParticleBurst } = useGameFeedback();

  const [activeTab, setActiveTab] = useState<ModuleCategory>("primary");
  const [ownedModules, setOwnedModules] = useState<PlayerModule[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);

  const open = activeModal === "tech_tree";

  useEffect(() => {
    if (open) {
      api
        .getModules()
        .then((r) => setOwnedModules(r.owned))
        .catch(() => {});
    }
  }, [open]);

  const getModulesForTier = (category: ModuleCategory, tier: ModuleTier) =>
    ALL_MODULES.filter((m) => m.category === category && m.tier === tier);

  const isOwned = (moduleId: string) =>
    ownedModules.find((m) => m.moduleId === moduleId);

  const isTierUnlocked = (category: ModuleCategory, tier: ModuleTier) => {
    const tierIdx = MODULE_TIERS.indexOf(tier);
    if (tierIdx === 0) return true;
    const prevTier = MODULE_TIERS[tierIdx - 1];
    const prevModules = getModulesForTier(category, prevTier);
    const ownedCount = prevModules.filter((m) => isOwned(m.id)).length;
    return ownedCount >= TIER_UNLOCK_REQUIREMENT;
  };

  const canAfford = (def: ModuleDefinition) => {
    if (!player) return false;
    const owned = isOwned(def.id);
    const level = owned?.level ?? 0;
    const cost = level > 0
      ? {
          credits: def.baseCost.credits + def.costPerLevel.credits * level,
          data: def.baseCost.data + def.costPerLevel.data * level,
        }
      : def.baseCost;
    return player.credits >= cost.credits && player.data >= cost.data;
  };

  const handlePurchase = async (moduleId: string, el: HTMLButtonElement) => {
    setProcessing(moduleId);
    try {
      const result = await api.purchaseModule({ moduleId });
      playSound("moduleUnlock");
      setPlayer(result.player);
      emitFloatNumber(`+${MODULE_PURCHASE_XP} XP`, "green", el);
      emitParticleBurst(el);
      // Refresh owned modules
      const modules = await api.getModules();
      setOwnedModules(modules.owned);
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch (err: any) {
      console.error("Purchase failed:", err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleMutate = async (moduleId: string) => {
    setMutating(moduleId);
    try {
      const result = await api.mutateModule({ moduleId });
      setPlayer(result.player);
      const modules = await api.getModules();
      setOwnedModules(modules.owned);
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch (err: any) {
      console.error("Mutation failed:", err.message);
    } finally {
      setMutating(null);
    }
  };

  const TIER_LABELS: Record<ModuleTier, string> = {
    basic: "BASIC",
    advanced: "ADVANCED",
    elite: "ELITE",
  };

  return (
    <Modal open={open} onClose={closeModal} title="TECH TREE" maxWidth="max-w-4xl">
      {/* Category tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-default pb-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-1.5 min-h-[44px] text-xs rounded-t transition-colors whitespace-nowrap ${
              activeTab === cat
                ? "text-cyber-cyan border-b-2 border-cyber-cyan bg-bg-elevated"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {MODULE_CATEGORIES[cat].label}
            <span className="ml-1 text-[10px] text-text-muted">
              ({MODULE_CATEGORIES[cat].lean})
            </span>
          </button>
        ))}
      </div>

      {/* Tier rows */}
      <div className="space-y-4">
        {MODULE_TIERS.map((tier) => {
          const modules = getModulesForTier(activeTab, tier);
          const unlocked = isTierUnlocked(activeTab, tier);

          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {TIER_LABELS[tier]}
                </span>
                {!unlocked && (
                  <span className="text-[9px] text-cyber-amber">
                    Requires {TIER_UNLOCK_REQUIREMENT}/3 {MODULE_TIERS[MODULE_TIERS.indexOf(tier) - 1]} modules
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {modules.map((def) => (
                  <ModuleCard
                    key={def.id}
                    definition={def}
                    owned={isOwned(def.id)}
                    canPurchase={unlocked && canAfford(def)}
                    isLocked={!unlocked}
                    lockReason={
                      !unlocked
                        ? `Need ${TIER_UNLOCK_REQUIREMENT} ${MODULE_TIERS[MODULE_TIERS.indexOf(tier) - 1]} modules`
                        : undefined
                    }
                    onPurchase={(el) => handlePurchase(def.id, el)}
                    onMutate={() => handleMutate(def.id)}
                    isProcessing={processing === def.id}
                    isMutating={mutating === def.id}
                    playerResources={player ? { credits: player.credits, data: player.data, processingPower: player.processingPower } : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
