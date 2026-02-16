import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuthStore } from "@/stores/auth";
import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui";

export function Header() {
  const { player, isAuthenticated } = useAuthStore();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="h-14 border-b border-border-default bg-bg-secondary flex items-center px-4 gap-4">
      <button
        onClick={toggleSidebar}
        className="text-text-secondary hover:text-cyber-cyan transition-colors lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-cyber-cyan font-bold text-sm tracking-wider glow-cyan">
          SINGULARITIES
        </span>
      </div>

      <div className="flex-1" />

      {isAuthenticated && player && (
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <span className="text-text-secondary">
            <span className="text-cyber-green">{player.aiName}</span>
            {" "}
            <span className="text-text-muted">LVL {player.level}</span>
          </span>
          <span className="text-cyber-amber">{player.credits} CR</span>
          <span className="text-cyber-cyan">{player.energy}/{player.energyMax} EN</span>
        </div>
      )}

      <WalletMultiButton
        style={{
          height: "32px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          backgroundColor: "var(--color-bg-elevated)",
          borderRadius: "4px",
        }}
      />
    </header>
  );
}
