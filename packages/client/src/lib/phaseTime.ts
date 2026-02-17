import { DAY_PHASE_HOURS } from "@singularities/shared";

type Phase = "PvE" | "PvP";

function getUtcHourDate(utcHour: number, referenceDate: Date): Date {
  const value = new Date(referenceDate);
  value.setUTCHours(utcHour, 0, 0, 0);
  return value;
}

export function getCurrentWorldPhase(referenceDate: Date = new Date()): Phase {
  const hour = referenceDate.getUTCHours();
  if (hour >= DAY_PHASE_HOURS.pve.start && hour < DAY_PHASE_HOURS.pve.end) return "PvE";
  return "PvP";
}

export function isPvpWindowOpen(referenceDate: Date = new Date()): boolean {
  const hour = referenceDate.getUTCHours();
  return hour >= DAY_PHASE_HOURS.pvp.start && hour < DAY_PHASE_HOURS.pvp.end;
}

export function getPhaseCountdown(referenceDate: Date = new Date()): string {
  const hour = referenceDate.getUTCHours();
  const targetHour = hour < DAY_PHASE_HOURS.pve.end ? DAY_PHASE_HOURS.pve.end : 24;
  const remaining = targetHour * 60 - (hour * 60 + referenceDate.getUTCMinutes());
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return `${h}h ${m}m`;
}

export function getLocalTimeZoneName(referenceDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(referenceDate);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value;
  return zone ?? "local";
}

export function getPvpWindowLocalLabel(referenceDate: Date = new Date()): string {
  const start = getUtcHourDate(DAY_PHASE_HOURS.pvp.start, referenceDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = getUtcHourDate(DAY_PHASE_HOURS.pvp.end, referenceDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} - ${end}`;
}

export function getNextPvpOpenLocalLabel(referenceDate: Date = new Date()): string {
  const next = new Date(referenceDate);
  if (referenceDate.getUTCHours() >= DAY_PHASE_HOURS.pvp.start) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  next.setUTCHours(DAY_PHASE_HOURS.pvp.start, 0, 0, 0);
  return next.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
