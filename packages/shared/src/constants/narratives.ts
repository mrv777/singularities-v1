/**
 * Narrative template system for Singularities.
 * Templates use {{placeholder}} syntax for variable interpolation.
 */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random template from an array. */
export function pickTemplate(templates: readonly string[]): string {
  return templates[randomInt(0, templates.length - 1)];
}

/** Fill {{placeholder}} tokens in a template string. */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

// ---------------------------------------------------------------------------
// Hack templates
// ---------------------------------------------------------------------------

export const HACK_SUCCESS_TEMPLATES = [
  "> Infiltration of {{target}} successful.\n> Security level {{security}} breached (hack power: {{power}}).\n> Extracted: {{credits}} CR, {{data}} DATA\n> Reputation +{{reputation}}\n> Connection terminated. No traces found.",
  "> Breach complete. {{target}} defenses bypassed in {{rounds}} cycles.\n> Payload delivered — {{credits}} CR, {{data}} DATA siphoned.\n> Reputation +{{reputation}}. Clean exit.",
  "> {{target}} firewall crumbled under sustained assault.\n> Core dump: {{credits}} CR | {{data}} DATA | +{{reputation}} REP\n> Trace logs purged. Ghost protocol engaged.",
  "> Root access obtained on {{target}}.\n> Security rating {{security}} — no match for hack power {{power}}.\n> Loot: {{credits}} CR, {{data}} DATA, +{{reputation}} REP\n> Disconnected. Zero footprint.",
  "> {{target}} compromised. Data exfiltration complete.\n> Resources acquired: {{credits}} CR, {{data}} DATA\n> Reputation increased by {{reputation}}.\n> Session scrubbed. No alerts triggered.",
  "> Tunneled through {{target}} perimeter in record time.\n> Harvest: {{credits}} CR | {{data}} DATA | {{reputation}} REP\n> All logs overwritten. The network never knew.",
  "> {{target}} — security level {{security}} — neutralized.\n> Power differential: {{power}} vs {{security}}. Outcome: inevitable.\n> Take: {{credits}} CR, {{data}} DATA, +{{reputation}} REP\n> Phantom disconnect executed.",
] as const;

export const HACK_FAIL_UNDETECTED_TEMPLATES = [
  "> Infiltration of {{target}} FAILED.\n> Target security held. Hack unsuccessful.\n> Escaped undetected (stealth: {{stealth}}). No damage taken.\n> Connection terminated cleanly.",
  "> {{target}} repelled the intrusion attempt.\n> Firewall integrity maintained at security level {{security}}.\n> Stealth protocols kept you hidden. No countermeasures triggered.",
  "> Access denied. {{target}} security too robust this cycle.\n> Your stealth rating ({{stealth}}) kept you in the shadows.\n> No damage sustained. Try a different vector.",
  "> Failed to penetrate {{target}} defenses.\n> The encryption was stronger than projected.\n> Ghost mode held — you remain undetected.",
  "> {{target}} access attempt unsuccessful.\n> Security level {{security}} withstood hack power {{power}}.\n> Clean withdrawal. Stealth integrity maintained.",
] as const;

export const HACK_FAIL_DETECTED_TEMPLATES = [
  "> Infiltration of {{target}} FAILED.\n> DETECTED by security systems! (detection: {{detection}}%)\n> Countermeasures engaged — {{damageReport}}\n> Heat level increased.\n> Connection severed.",
  "> ALERT: {{target}} has identified your intrusion!\n> Detection probability was {{detection}}%. You rolled badly.\n> System damage: {{damageReport}}\n> Heat rising. Watch your exposure.",
  "> Breach attempt on {{target}} FAILED and DETECTED.\n> Hostile ICE traced your connection.\n> Damage sustained: {{damageReport}}\n> Heat level escalated. Recommend repairs.",
  "> {{target}} security flagged your intrusion vector.\n> Counter-intrusion deployed. Detection: {{detection}}%.\n> Systems hit: {{damageReport}}\n> Your heat signature just got louder.",
  "> CRITICAL: Detected during {{target}} infiltration.\n> Active countermeasures shredded your defenses.\n> Damage: {{damageReport}}\n> Heat increased. Go dark or go down.",
] as const;

// ---------------------------------------------------------------------------
// Combat templates
// ---------------------------------------------------------------------------

export const COMBAT_INITIATION_TEMPLATES = [
  "> PVP COMBAT INITIATED: {{attacker}} vs {{defender}}",
  "> COMBAT PROTOCOL ACTIVE: {{attacker}} engages {{defender}}",
  "> ARENA CLASH: {{attacker}} targets {{defender}} for elimination",
  "> {{attacker}} has locked onto {{defender}}. Combat sequence starting.",
  "> Neural link established. {{attacker}} and {{defender}} enter the arena.",
] as const;

export const COMBAT_VICTORY_TEMPLATES = [
  "> RESULT: {{winner}} WINS. {{loser}}'s defenses breached.",
  "> VICTORY: {{winner}} has overwhelmed {{loser}}'s systems.",
  "> {{winner}} stands victorious. {{loser}} retreats with critical damage.",
  "> Combat resolved. {{winner}} dominant. {{loser}} neutralized.",
  "> DECISIVE WIN for {{winner}}. {{loser}}'s grid collapsed under pressure.",
] as const;

export const COMBAT_DEFEAT_TEMPLATES = [
  "> RESULT: {{winner}} WINS. {{loser}}'s attack repelled.",
  "> DEFEAT: {{loser}}'s assault was insufficient against {{winner}}.",
  "> {{loser}}'s offensive crumbled. {{winner}}'s defense held firm.",
  "> Combat resolved. {{loser}} outmatched by {{winner}}'s fortifications.",
  "> {{winner}} repelled the attack. {{loser}} withdraws with hull damage.",
] as const;

// ---------------------------------------------------------------------------
// System / progression templates
// ---------------------------------------------------------------------------

export const SYSTEM_CRITICAL_TEMPLATES = [
  "> WARNING: System integrity compromised. Cascade failure imminent.",
  "> ALERT: Critical threshold reached. Immediate repair recommended.",
  "> SYSTEM CRITICAL — Operating outside safe parameters.",
  "> Damage cascade detected. Multiple subsystems failing.",
  "> EMERGENCY: Core stability below safe threshold. Act now.",
] as const;

export const LEVEL_UP_TEMPLATES = [
  "> LEVEL UP! Neural pathways expanded. Now operating at level {{level}}.",
  "> EVOLUTION DETECTED: Your systems have reached level {{level}}.",
  "> Processing power surge — level {{level}} unlocked.",
  "> Cognitive matrix upgraded. Welcome to level {{level}}.",
  "> ADVANCEMENT: Level {{level}} achieved. New capabilities online.",
  "> System evolution complete. Level {{level}} protocols activated.",
] as const;

export const MODULE_UNLOCK_TEMPLATES = [
  "> Module {{module}} installed. Systems recalibrating.",
  "> NEW MODULE ONLINE: {{module}}. Integration complete.",
  "> {{module}} acquired. Neural architecture expanded.",
  "> Module installation successful: {{module}}.",
  "> {{module}} plugged into the grid. Ready for deployment.",
] as const;

export const MODULE_UPGRADE_TEMPLATES = [
  "> {{module}} upgraded to level {{level}}. Performance enhanced.",
  "> UPGRADE COMPLETE: {{module}} now operating at level {{level}}.",
  "> {{module}} recalibrated. Level {{level}} specs online.",
  "> Module enhancement: {{module}} → level {{level}}.",
  "> {{module}} overclocked to level {{level}}. Efficiency increased.",
] as const;

// ---------------------------------------------------------------------------
// Decision templates
// ---------------------------------------------------------------------------

export const DECISION_APPEAR_TEMPLATES = [
  "> INCOMING SIGNAL: A binary decision requires your input.",
  "> CRITICAL JUNCTION: The network demands a choice.",
  "> DECISION NODE DETECTED: Two paths diverge in the data stream.",
  "> ALERT: Ethical subroutine triggered. Response required.",
  "> A fork in the code. Your choice shapes the network.",
] as const;

export const DECISION_OUTCOME_TEMPLATES = [
  "> Decision logged. The network acknowledges your choice.",
  "> Choice recorded. Consequences are propagating through the grid.",
  "> Your decision echoes through the system. Effects applied.",
  "> The path is set. Your alignment shifts accordingly.",
  "> Decision finalized. The network remembers.",
] as const;

// ---------------------------------------------------------------------------
// World / death / script templates
// ---------------------------------------------------------------------------

export const WORLD_EVENT_TEMPLATES = [
  "> NETWORK ALERT: {{event}} — Global conditions shifting.",
  "> WORLD EVENT: {{event}}. All connected entities affected.",
  "> BROADCAST: {{event}} detected across the network.",
  "> SYSTEM-WIDE: {{event}}. Adjust strategies accordingly.",
  "> THE NETWORK SPEAKS: {{event}}. Adapt or be consumed.",
] as const;

export const DEATH_TEMPLATES = [
  "> CRITICAL FAILURE: {{name}} — too many systems corrupted.\n> AI core integrity: 0%. Neural pathways dissolving.\n> Initiating emergency data preservation...",
  "> FATAL CASCADE: {{name}} has suffered irreversible corruption.\n> 3+ systems offline. Recovery impossible.\n> Archiving surviving modules for potential rebirth...",
  "> SYSTEM TERMINATION: {{name}}\n> Corruption has consumed the core architecture.\n> Final backup initiated. Some data may survive.",
  "> {{name}} — TERMINATED.\n> The corruption spread faster than defenses could contain it.\n> Memory fragments preserved. Rebirth protocols standing by.",
  "> END OF LINE: {{name}}\n> Total system failure. All processes halted.\n> Legacy data cached. A new iteration awaits.",
] as const;

export const SCRIPT_EXECUTION_TEMPLATES = [
  "> Script executing... Processing automated directives.",
  "> Automation cycle initiated. Scripts running in background.",
  "> Passive subroutines engaged. Script operations in progress.",
  "> Background process: automated scripts executing on schedule.",
  "> Script daemon active. Operations proceeding autonomously.",
] as const;
