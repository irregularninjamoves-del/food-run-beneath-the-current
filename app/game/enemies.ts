export type EnemyTier = "minion" | "lieutenant" | "boss";
export type EnemyKind = "needlefish" | "reef-shark" | "ancient-shark";

export interface EnemyArchetype {
  kind: EnemyKind;
  tier: EnemyTier;
  name: string;
  visionRadius: number;
  hearingRadius: number;
  sonarRadius: number;
  disengageRadius: number;
  patrolRadius: number;
  patrolSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
  attackRadius: number;
  damage: number;
  scale: number;
  alertGain: number;
}

export const ENEMY_ARCHETYPES: Record<EnemyKind, EnemyArchetype> = {
  "needlefish": {
    kind: "needlefish",
    tier: "minion",
    name: "Needlefish Scout",
    visionRadius: 145,
    hearingRadius: 210,
    sonarRadius: 270,
    disengageRadius: 285,
    patrolRadius: 125,
    patrolSpeed: 68,
    investigateSpeed: 82,
    chaseSpeed: 128,
    attackRadius: 31,
    damage: 1,
    scale: 0.62,
    alertGain: 0.92,
  },
  "reef-shark": {
    kind: "reef-shark",
    tier: "lieutenant",
    name: "Reef Shark",
    visionRadius: 275,
    hearingRadius: 430,
    sonarRadius: 520,
    disengageRadius: 570,
    patrolRadius: 170,
    patrolSpeed: 48,
    investigateSpeed: 92,
    chaseSpeed: 175,
    attackRadius: 48,
    damage: 1,
    scale: 1,
    alertGain: 1.25,
  },
  "ancient-shark": {
    kind: "ancient-shark",
    tier: "boss",
    name: "Ancient Shark",
    visionRadius: 520,
    hearingRadius: 760,
    sonarRadius: 880,
    disengageRadius: 940,
    patrolRadius: 280,
    patrolSpeed: 36,
    investigateSpeed: 105,
    chaseSpeed: 198,
    attackRadius: 82,
    damage: 2,
    scale: 1.85,
    alertGain: 1.7,
  },
};

export const TIER_COLORS: Record<EnemyTier, string> = {
  minion: "#f6d66b",
  lieutenant: "#ff8a78",
  boss: "#ef5eff",
};
