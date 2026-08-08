export type TalentId =
  | "quiet-wake"
  | "deep-pockets"
  | "current-rider"
  | "stun-bubble"
  | "slipstream"
  | "preserver"
  | "keen-eyes"
  | "dream-bubble"
  | "shadow-skin"
  | "keen-current"
  | "tide-dancer"
  | "guardian-bubble";

export interface TalentDefinition {
  id: TalentId;
  name: string;
  description: string;
  level: number;
  branch: "stealth" | "gathering" | "voyage" | "bubble";
  prerequisite?: TalentId;
  /** Talents sharing an exclusiveGroup are alternatives: only one may ever be unlocked. */
  exclusiveGroup?: string;
}

export const TALENTS: TalentDefinition[] = [
  { id: "quiet-wake", name: "Quiet Wake", description: "Burst noise radius −28%", level: 3, branch: "stealth" },
  { id: "deep-pockets", name: "Deep Pockets", description: "+2 bag capacity", level: 3, branch: "gathering" },
  { id: "current-rider", name: "Current Rider", description: "Swim speed +8%", level: 3, branch: "voyage" },
  { id: "stun-bubble", name: "Stun Pop", description: "Decoy pops briefly stun hunters", level: 3, branch: "bubble", exclusiveGroup: "bubble-craft" },
  { id: "slipstream", name: "Slipstream", description: "Escape nets with less drag", level: 5, branch: "stealth", prerequisite: "quiet-wake" },
  { id: "preserver", name: "Preserver", description: "Keep 1 food after defeat", level: 5, branch: "gathering", prerequisite: "deep-pockets" },
  { id: "keen-eyes", name: "Keen Eyes", description: "Sense hunters from much farther", level: 5, branch: "voyage", prerequisite: "current-rider" },
  { id: "dream-bubble", name: "Slumber Mist", description: "Popped bubbles lull hunters to sleep", level: 5, branch: "bubble", exclusiveGroup: "bubble-craft" },
  { id: "shadow-skin", name: "Shadow Skin", description: "Predator sight radius −18%", level: 7, branch: "stealth", prerequisite: "slipstream" },
  { id: "keen-current", name: "Keen Current", description: "Chance to improve food finds", level: 7, branch: "gathering", prerequisite: "preserver" },
  { id: "tide-dancer", name: "Tide Dancer", description: "Currents push you 45% less", level: 7, branch: "voyage", prerequisite: "keen-eyes" },
  { id: "guardian-bubble", name: "Guardian Illusion", description: "Pops become a giant fish that scares minions", level: 7, branch: "bubble", exclusiveGroup: "bubble-craft" },
];

export const talentPointsForLevel = (level: number) => Math.max(0, Math.floor((level - 1) / 2));

export const hasTalent = (unlocked: string[], talent: TalentId) => unlocked.includes(talent);

/** Returns the already-unlocked alternative blocking this talent, if its exclusive group is taken. */
export function exclusiveGroupTaken(unlocked: string[], talent: TalentDefinition): TalentDefinition | null {
  if (!talent.exclusiveGroup) return null;
  return TALENTS.find((other) => other.id !== talent.id && other.exclusiveGroup === talent.exclusiveGroup && unlocked.includes(other.id)) ?? null;
}
