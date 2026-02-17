import { ShieldCheck, ExternalLink } from "lucide-react";

interface OnChainBadgeProps {
  txSignature: string;
}

const EXPLORER_BASE = "https://explorer.solana.com/tx";

export function OnChainBadge({ txSignature }: OnChainBadgeProps) {
  const url = `${EXPLORER_BASE}/${txSignature}?cluster=devnet`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan text-[10px] font-medium hover:bg-cyber-cyan/10 hover:border-cyber-cyan/50 transition-colors"
    >
      <ShieldCheck size={12} />
      <span>Verified on-chain</span>
      <ExternalLink size={10} className="opacity-60" />
    </a>
  );
}
