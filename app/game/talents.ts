export type TalentId =
  | "quiet-wake"
  | "deep-pockets"
  | "slipstream"
  | "preserver"
  | "shadow-skin"
  | "keen-current";

export interface TalentDefinition {
  id: TalentId;
  name: string;
  description: string;
  level: number;
  branch: "stealth" | "gathering";
  prerequisite?: TalentId;
}

export const TALENTS: TalentDefinition[] = [
  { id: "quiet-wake", name: "Quiet Wake", description: "Burst noise radius −28%", level: 3, branch: "stealth" },
  { id: "deep-pockets", name: "Deep Pockets", description: "+2 bag capacity", level: 3, branch: "gathering" },
  { id: "slipstream", name: "Slipstream", description: "Escape nets with less drag", level: 5, branch: "stealth", prerequisite: "quiet-wake" },
  { id: "preserver", name: "Preserver", description: "Keep 1 food after defeat", level: 5, branch: "gathering", prerequisite: "deep-pockets" },
  { id: "shadow-skin", name: "Shadow Skin", description: "Predator sight radius −18%", level: 7, branch: "stealth", prerequisite: "slipstream" },
  { id: "keen-current", name: "Keen Current", description: "Chance to improve food finds", level: 7, branch: "gathering", prerequisite: "preserver" },
];

export const talentPointsForLevel = (level: number) => Math.max(0, Math.floor((level - 1) / 2));

export const hasTalent = (unlocked: string[], talent: TalentId) => unlocked.includes(talent);
