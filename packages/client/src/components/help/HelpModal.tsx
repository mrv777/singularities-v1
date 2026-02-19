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
            You are an autonomous AI operating inside the Singularities network. Your core objective is to grow your
            capabilities over time: scan for targets, run hacks, upgrade your module stack, and stay operational while
            other AIs compete with you.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Game Loop</div>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li><span className="text-text-secondary">Scan</span> to generate fresh targets</li>
              <li><span className="text-text-secondary">Hack</span> targets for credits, data, XP, and occasional processing power</li>
              <li><span className="text-text-secondary">Upgrade</span> and level modules in the Tech Tree</li>
              <li><span className="text-text-secondary">Equip</span> modules in infiltration/defense loadouts</li>
              <li><span className="text-text-secondary">Repair</span> damage when detection or PvP harms systems</li>
              <li><span className="text-text-secondary">Compete</span> in Arena during PvP phase</li>
            </ol>
          </div>
          <p className="text-text-muted">
            New players start in Sandbox mode. Reach level {SANDBOX_EXIT_LEVEL} to unlock sandbox exit and move into
            the live network.
          </p>
        </div>
      );
    case "resources":
      return (
        <div className="space-y-2">
          {[
            { icon: <Coins size={14} className="text-cyber-amber" />, name: "Credits", color: "text-cyber-amber", desc: "Your primary currency. Spend on module unlocks, module levels, repairs, and other systems." },
            { icon: <Zap size={14} className="text-cyber-cyan" />, name: "Energy", color: "text-cyber-cyan", desc: "Your action budget. Used by scans, hacks, repairs, and PvP attacks; regenerates over time." },
            { icon: <Database size={14} className="text-cyber-green" />, name: "Data", color: "text-cyber-green", desc: "A progression resource from hacks. Mostly used for module upgrades and mutations." },
            { icon: <Cpu size={14} className="text-cyber-magenta" />, name: "Processing Power", color: "text-cyber-magenta", desc: "Sets maximum loadout capacity and is required for some advanced actions. Mostly earned from higher-risk activities." },
            { icon: <Star size={14} className="text-text-secondary" />, name: "Reputation", color: "text-text-secondary", desc: "Your network standing. Impacts PvP context and certain event outcomes." },
            { icon: <Trophy size={14} className="text-cyber-cyan" />, name: "XP", color: "text-cyber-cyan", desc: "Experience for leveling up. Higher level unlocks more nodes and systems." },
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
          <p>
            The Network Scanner is your main PvE entry point. Use it to discover targets, evaluate risk, and run
            infiltration hacks for resources.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How it works</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Scanning costs <span className="text-cyber-cyan">{SCAN_ENERGY_COST} energy</span> and reveals 5 targets</li>
              <li>Targets expire after 10 minutes, so plan hacks before the list refreshes</li>
              <li>Each target shows security, risk, detection chance, and reward preview</li>
              <li>Higher security generally gives better rewards, but costs more energy and carries higher detection risk</li>
              <li>Your equipped infiltration modules strongly affect hack performance</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Detection Risk</div>
            <p className="text-text-muted">
              Failed hacks can trigger detection and increase heat. High-security targets also run persistent breach
              monitoring — even a clean exit can log a trace. Detection damages random systems, and higher heat increases
              severity. Relay (stealth) modules reduce residual trace risk on high-security targets.
            </p>
          </div>
        </div>
      );
    case "tech_tree":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            The Tech Tree (unlocks at level 2) contains 36 modules across 4 categories and 3 tiers: Basic, Advanced,
            and Elite.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Categories</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li><span className="text-text-secondary">Primary (Offense)</span> — Hack pressure and penetration</li>
              <li><span className="text-text-secondary">Secondary (Utility)</span> — Resource bonuses and efficiency</li>
              <li><span className="text-text-secondary">Relay (Stealth)</span> — Evasion and detection control</li>
              <li><span className="text-text-secondary">Backup (Defense)</span> — Resilience and mitigation</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Progression Rules</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Each module can be upgraded to level 5</li>
              <li>To unlock a higher tier in a category, own 2 of 3 modules from the previous tier</li>
              <li>Upgrades improve module stats, then you choose which owned modules to equip in loadouts</li>
            </ul>
          </div>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Mutations</div>
            <p className="text-text-muted">
              At level 3+, modules become mutation-eligible. Mutation has a 65% success rate and can add a unique
              variant effect. Each attempt costs {MUTATION_COST.credits} credits, {MUTATION_COST.data} data, and{" "}
              {MUTATION_COST.processingPower} processing power.
            </p>
          </div>
        </div>
      );
    case "maintenance":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Your AI core is backed by 6 systems. Detection events and PvP losses can damage these systems and reduce
            operational strength.
          </p>
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
              Repairs cost {ENERGY_COSTS.repair} energy plus variable credits based on missing health (about{" "}
              {getRepairCreditCostForHealth(50)} credits at 50% health) and restore 30 HP per repair. Critical and
              corrupted systems can spread cascade damage to neighbors, so repairing early prevents chain failures.
            </p>
          </div>
        </div>
      );
    case "scripts":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Scripts are lightweight automation rules. They watch game state and run predefined actions when your
            selected conditions are met.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How Scripts Work</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Create a script by pairing a trigger condition with an action</li>
              <li>Example triggers: "Energy full", "System critical", or similar thresholds</li>
              <li>Example actions: "Auto-scan", "Auto-repair", and other available operations</li>
              <li>Enable/disable scripts at any time, or delete ones you no longer need</li>
            </ul>
          </div>
        </div>
      );
    case "data_vault":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Data Vault converts stored telemetry into short, reliable temporary boosts.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">How it works</div>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>Activate one protocol at a time (deterministic, no failure roll)</li>
              <li>Protocols consume credits + data and remain active for a short duration</li>
              <li>You have a short cooldown and a daily activation cap</li>
              <li>The recommended protocol adapts to your heat level and current resource balance</li>
              <li>Focus Cache boosts hack power for early PvE, Ghost Cache prioritizes stealth safety, Harvest Cache boosts data gain, Tandem Cache is balanced</li>
            </ul>
          </div>
        </div>
      );
    case "arena":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Arena is real-player PvP combat. It opens only during the PvP phase and uses your configured loadouts.
          </p>
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
              Each attack costs {PVP_ENERGY_COST} energy. Your infiltration loadout is used offensively while the
              defender's defense loadout responds automatically. Winners gain rewards; losers can take system damage.
            </p>
          </div>
        </div>
      );
    case "security":
      return (
        <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
          <p>
            Security Center is your defensive control panel. It sets your passive PvP defense behavior and helps you
            monitor pressure from detection.
          </p>
          <div className="space-y-1">
            <div className="text-text-primary font-semibold text-[11px]">Defense Loadout</div>
            <p className="text-text-muted">
              Equip up to 3 modules in defense slots. These are separate from your infiltration setup and activate
              when another player attacks you. Defense, stealth, and detection-reduction effects are typically best.
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
