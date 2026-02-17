import type { ArenaOpponent } from "@singularities/shared";
import { Swords } from "lucide-react";

interface OpponentCardProps {
  opponent: ArenaOpponent;
  onAttack: (id: string) => void;
  isAttacking: boolean;
}

const PLAYSTYLE_COLORS: Record<string, string> = {
  Offense: "text-cyber-red",
  Defense: "text-cyber-cyan",
  Stealth: "text-cyber-purple",
  Balanced: "text-cyber-yellow",
};

export function OpponentCard({ opponent, onAttack, isAttacking }: OpponentCardProps) {
  return (
    <div className="border border-border-default bg-bg-secondary rounded p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-text-primary text-sm font-semibold truncate">
            {opponent.aiName}
          </span>
          {opponent.isBot && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyber-yellow text-cyber-yellow">
              SIM
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border border-current ${PLAYSTYLE_COLORS[opponent.playstyle] ?? "text-text-muted"}`}>
            {opponent.playstyle}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
          <span>LVL {opponent.level}</span>
          <span>REP {opponent.reputation}</span>
          {opponent.alignment > 0.3 ? (
            <span className="text-cyber-green">Benevolent</span>
          ) : opponent.alignment < -0.3 ? (
            <span className="text-cyber-red">Domination</span>
          ) : null}
          {opponent.isBot && (
            <span className="text-cyber-yellow/90">Reduced rewards</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onAttack(opponent.id)}
        disabled={isAttacking}
        className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] border border-cyber-red text-cyber-red rounded text-xs hover:bg-cyber-red/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        <Swords size={12} />
        Attack
      </button>
    </div>
  );
}
