export type TalentId =
  | "quiet-wake"
  | "deep-pockets"
  | "current-rider"
  | "slipstream"
  | "preserver"
  | "keen-eyes"
  | "shadow-skin"
  | "keen-current"
  | "tide-dancer";

export interface TalentDefinition {
  id: TalentId;
  name: string;
  description: string;
  level: number;
  branch: "stealth" | "gathering" | "voyage";
  prerequisite?: TalentId;
}

export const TALENTS: TalentDefinition[] = [
  { id: "quiet-wake", name: "Quiet Wake", description: "Burst noise radius −28%", level: 3, branch: "stealth" },
  { id: "deep-pockets", name: "Deep Pockets", description: "+2 bag capacity", level: 3, branch: "gathering" },
  { id: "current-rider", name: "Current Rider", description: "Swim speed +8%", level: 3, branch: "voyage" },
  { id: "slipstream", name: "Slipstream", description: "Escape nets with less drag", level: 5, branch: "stealth", prerequisite: "quiet-wake" },
  { id: "preserver", name: "Preserver", description: "Keep 1 food after defeat", level: 5, branch: "gathering", prerequisite: "deep-pockets" },
  { id: "keen-eyes", name: "Keen Eyes", description: "Sense hunters from much farther", level: 5, branch: "voyage", prerequisite: "current-rider" },
  { id: "shadow-skin", name: "Shadow Skin", description: "Predator sight radius −18%", level: 7, branch: "stealth", prerequisite: "slipstream" },
  { id: "keen-current", name: "Keen Current", description: "Chance to improve food finds", level: 7, branch: "gathering", prerequisite: "preserver" },
  { id: "tide-dancer", name: "Tide Dancer", description: "Currents push you 45% less", level: 7, branch: "voyage", prerequisite: "keen-eyes" },
];

export const talentPointsForLevel = (level: number) => Math.max(0, Math.floor((level - 1) / 2));

export const hasTalent = (unlocked: string[], talent: TalentId) => unlocked.includes(talent);
