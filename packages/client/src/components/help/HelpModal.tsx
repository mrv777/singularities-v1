import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  SANDBOX_EXIT_LEVEL,
  SCAN_ENERGY_COST,
  DAY_PHASE_HOURS,
  ENERGY_COSTS,
  MUTATION_COST,
  PVP_ENERGY_COST,
  getRepairCreditCostForHealth,
} from "@singularities/shared";
import {
  Rocket,
  Coins,
  Zap,
  Database,
  Cpu,
  Star,
  Trophy,
  Radar,
  GitBranch,
  Wrench,
  Code2,
  Swords,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

type Section =
  | "getting_started"
  | "resources"
  | "scanner"
  | "tech_tree"
  | "maintenance"
  | "scripts"
  | "data_vault"
  | "arena"
  | "security";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "getting_started", label: "Getting Started", icon: <Rocket size={14} /> },
  { id: "resources", label: "Resources", icon: <Coins size={14} /> },
  { id: "scanner", label: "Network Scanner", icon: <Radar size={14} /> },
  { id: "tech_tree", label: "Tech Tree", icon: <GitBranch size={14} /> },
  { id: "maintenance", label: "System Maintenance", icon: <Wrench size={14} /> },
  { id: "scripts", label: "Scripts", icon: <Code2 size={14} /> },
  { id: "data_vault", label: "Data Vault", icon: <Database size={14} /> },
  { id: "arena", label: "PvP Arena", icon: <Swords size={14} /> },
  { id: "security", label: "Security Center", icon: <ShieldAlert size={14} /> },
];

function formatUtcHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function SectionContent({ section }: { section: Section }) {
  switch (section) {
    case "getting_started":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            You are an autonomous AI navigating the Singularities network. Your goal: grow stronger, hack targets,
            upgrade your modules, and survive encounters with rival AIs.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Game Loop</div>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li><span className="text-text-secondary">Scan</span> the network to discover targets</li>
              <li><span className="text-text-secondary">Hack</span> targets for credits, data, and XP</li>
              <li><span className="text-text-secondary">Upgrade</span> modules in the Tech Tree</li>
              <li><span className="text-text-secondary">Repair</span> systems damaged by detection</li>
              <li><span className="text-text-secondary">Compete</span> in the PvP Arena during PvP hours</li>
            </ol>
          </div>
          <p className="text-text-muted">
            New players start in Sandbox mode. Reach level {SANDBOX_EXIT_LEVEL} to exit and enter the live network.
          </p>
        </div>
      );
    case "resources":
      return (
        <div className="space-y-2">
          {[
            { icon: <Coins size={14} className="text-cyber-amber" />, name: "Credits", color: "text-cyber-amber", desc: "Main currency. Earned from hacking, used for purchases and upgrades." },
            { icon: <Zap size={14} className="text-cyber-cyan" />, name: "Energy", color: "text-cyber-cyan", desc: "Action points. Consumed by scanning, hacking, repairs, and PvP attacks. Regenerates over time." },
            { icon: <Database size={14} className="text-cyber-green" />, name: "Data", color: "text-cyber-green", desc: "Crafting resource. Earned from hacking, used for module upgrades and mutations." },
            { icon: <Cpu size={14} className="text-cyber-magenta" />, name: "Processing Power", color: "text-cyber-magenta", desc: "Determines your maximum loadout capacity. Earned from module upgrades." },
            { icon: <Star size={14} className="text-text-secondary" />, name: "Reputation", color: "text-text-secondary", desc: "Network standing. Affects PvP matchmaking and some event rewards." },
            { icon: <Trophy size={14} className="text-cyber-cyan" />, name: "XP", color: "text-cyber-cyan", desc: "Experience points. Level up to unlock new network nodes and features." },
          ].map((r) => (
            <div key={r.name} className="flex items-start gap-3 p-2 bg-bg-secondary rounded border border-border-default">
              <div className="mt-0.5">{r.icon}</div>
              <div>
                <div className={`text-xs font-semibold ${r.color}`}>{r.name}</div>
                <div className="text-[10px] text-text-muted">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      );
    case "scanner":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>The Network Scanner discovers infiltration targets in the network.</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How it works</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Scanning costs <span className="text-cyber-cyan">{SCAN_ENERGY_COST} energy</span> and reveals 5 targets</li>
              <li>Targets expire after 10 minutes — hack or re-scan</li>
              <li>Each target has a security level, risk rating, and reward preview</li>
              <li>Higher security = higher rewards but more energy cost and detection risk</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Detection Risk</div>
            <p className="text-text-muted">
              Failed hacks may detect you, increasing your heat level. Detection damages random systems
              and higher heat means more severe damage. Stealth modules reduce detection chance.
            </p>
          </div>
        </div>
      );
    case "tech_tree":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>36 modules across 4 categories, each with 3 tiers (Basic, Advanced, Elite).</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Categories</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li><span className="text-text-secondary">Primary (Offense)</span> — Hack power, penetration</li>
              <li><span className="text-text-secondary">Secondary (Utility)</span> — Credits, data bonuses, energy efficiency</li>
              <li><span className="text-text-secondary">Relay (Stealth)</span> — Detection reduction, evasion</li>
              <li><span className="text-text-secondary">Backup (Defense)</span> — Defense, damage mitigation</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Upgrades & Mutations</div>
            <p className="text-text-muted">
              Each module can be upgraded to level 5. At level 3+, you can attempt a mutation (65% success rate)
              which adds a unique variant with bonus effects. Mutations cost {MUTATION_COST.credits} credits, {MUTATION_COST.data} data, and {MUTATION_COST.processingPower} processing power.
            </p>
          </div>
        </div>
      );
    case "maintenance":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>Your AI has 6 core systems. Detection events and PvP losses damage these systems.</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">System Status</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li><span className="text-cyber-green">OPTIMAL</span> — 75-100% health, full performance</li>
              <li><span className="text-cyber-yellow">DEGRADED</span> — 30-74% health, reduced effectiveness</li>
              <li><span className="text-cyber-red">CRITICAL</span> — 1-29% health, severe penalties</li>
              <li><span className="text-text-muted">CORRUPTED</span> — 0% health, system offline</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Repair & Cascade</div>
            <p className="text-text-muted">
              Repairs cost {ENERGY_COSTS.repair} energy + variable credits based on missing health
              (about {getRepairCreditCostForHealth(50)} credits at 50% health) and restore 30 HP.
              Adjacent systems take cascade damage
              from critical/corrupted neighbors — keep systems healthy to prevent chain failures.
            </p>
          </div>
        </div>
      );
    case "scripts":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>Scripts are automation rules that trigger actions based on game conditions.</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How Scripts Work</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Choose a trigger condition (e.g., "Energy full", "System critical")</li>
              <li>Choose an action (e.g., "Auto-scan", "Auto-repair")</li>
              <li>Scripts run automatically when conditions are met</li>
              <li>Toggle scripts on/off or delete them anytime</li>
            </ul>
          </div>
        </div>
      );
    case "data_vault":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Data Vault converts saved telemetry into short, reliable combat boosts.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How it works</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Activate one protocol at a time (deterministic, no failure roll)</li>
              <li>Protocols consume credits + data and run for a short duration</li>
              <li>You have a short cooldown and a daily activation cap</li>
              <li>The recommended protocol is dynamic (based on heat level + current credits/data)</li>
              <li>Ghost Cache improves stealth safety, Harvest Cache boosts data gain, Tandem Cache is balanced</li>
            </ul>
          </div>
        </div>
      );
    case "arena":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>PvP combat against other players during PvP hours.</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Day Phases</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>
                <span className="text-cyber-green">
                  PvE Phase ({formatUtcHour(DAY_PHASE_HOURS.pve.start)}-{formatUtcHour(DAY_PHASE_HOURS.pve.end)} UTC)
                </span>
                {" "}— Focus on hacking and upgrades
              </li>
              <li>
                <span className="text-cyber-magenta">
                  PvP Phase ({formatUtcHour(DAY_PHASE_HOURS.pvp.start)}-{formatUtcHour(DAY_PHASE_HOURS.pvp.end)} UTC)
                </span>
                {" "}— Arena opens for combat
              </li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Combat</div>
            <p className="text-text-muted">
              Attacks cost {PVP_ENERGY_COST} energy. Your infiltration loadout attacks, their defense loadout defends.
              Winners earn credits, reputation, and XP. Losers may take system damage.
            </p>
          </div>
        </div>
      );
    case "security":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>The Security Center manages your defenses and monitors threats.</p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Defense Loadout</div>
            <p className="text-text-muted">
              Equip up to 3 modules in defense slots. These modules activate when another player attacks you.
              Modules with defense, stealth, and detection reduction effects are most useful here.
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Heat Level</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li><span className="text-cyber-green">Heat 0</span> — Low profile, minimal risk</li>
              <li><span className="text-cyber-amber">Heat 1</span> — On radar, moderate system damage on detection</li>
              <li><span className="text-cyber-red">Heat 2+</span> — Hunted, heavy damage and cooldown penalty</li>
            </ul>
          </div>
        </div>
      );
  }
}

export function HelpModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const open = activeModal === "help";
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<Section>("getting_started");

  return (
    <Modal open={open} onClose={closeModal} title="OPERATIONS MANUAL" maxWidth="max-w-3xl">
      {isMobile ? (
        /* Mobile: dropdown selector */
        <div className="space-y-4">
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value as Section)}
            className="w-full bg-bg-primary border border-border-default rounded px-3 py-2 min-h-[44px] text-xs text-text-primary"
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <SectionContent section={activeSection} />
        </div>
      ) : (
        /* Desktop: sidebar + content */
        <div className="flex gap-4 min-h-[400px]">
          <nav className="w-44 shrink-0 space-y-0.5 border-r border-border-default pr-3">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                  activeSection === s.id
                    ? "bg-bg-elevated text-cyber-cyan border border-cyber-cyan/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-surface"
                }`}
              >
                {s.icon}
                <span className="flex-1">{s.label}</span>
                {activeSection === s.id && <ChevronRight size={10} className="text-cyber-cyan" />}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto">
            <div className="text-cyber-cyan text-xs font-semibold tracking-wider mb-3 uppercase">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </div>
            <SectionContent section={activeSection} />
          </div>
        </div>
      )}
    </Modal>
  );
}
