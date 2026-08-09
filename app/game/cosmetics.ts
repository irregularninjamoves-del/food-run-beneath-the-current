export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export interface SkinColors {
  /** Body gradient stops, nose to tail. */
  a: string;
  b: string;
  c: string;
  tail: string;
  belly: string;
}

export interface SkinDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  /** null means "use the fish type's built-in colors" (the starter look). */
  colors: SkinColors | null;
}

export interface ThemeDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  /** Coral stroke colors for the home reef. */
  corals: string[];
  label: string;
}

// Cosmetics are purely visual: rarity raises price and flair, never power.
export const SKINS: SkinDef[] = [
  { id: "starter", name: "Starter Fish", rarity: "common", cost: 0, colors: null },
  { id: "coral", name: "Coral Fish", rarity: "common", cost: 15, colors: { a: "#ff9d7e", b: "#f2698a", c: "#c74d75", tail: "#e26a86", belly: "#ffe3d1" } },
  { id: "midnight", name: "Midnight Fish", rarity: "uncommon", cost: 60, colors: { a: "#4a5f92", b: "#33406e", c: "#1d2647", tail: "#3a4a7d", belly: "#93a6d6" } },
  { id: "tropical", name: "Tropical Fish", rarity: "uncommon", cost: 60, colors: { a: "#ffe25a", b: "#41c9a2", c: "#2381c2", tail: "#ffb03a", belly: "#fdfbd4" } },
  { id: "golden", name: "Golden Fish", rarity: "rare", cost: 200, colors: { a: "#ffe28a", b: "#ffc23e", c: "#dd8f12", tail: "#f5b230", belly: "#fff3cf" } },
  { id: "neon", name: "Neon Fish", rarity: "epic", cost: 400, colors: { a: "#61ffe8", b: "#3ec9ff", c: "#8a5bff", tail: "#4be0ff", belly: "#d9fbff" } },
  { id: "bioluminescent", name: "Bioluminescent Fish", rarity: "epic", cost: 450, colors: { a: "#8dffd8", b: "#31c8b0", c: "#0f6f8d", tail: "#54e6c2", belly: "#defff4" } },
  { id: "ghost", name: "Ghost Fish", rarity: "legendary", cost: 750, colors: { a: "#e8f6ff", b: "#b8d4e6", c: "#8aa8c4", tail: "#cfe6f5", belly: "#ffffff" } },
];

export const THEMES: ThemeDef[] = [
  { id: "original", name: "Original Reef", rarity: "common", cost: 0, corals: ["#ff7f78", "#ffbf57", "#ba6fe0", "#37c29c"], label: "rgba(255,247,193,.9)" },
  { id: "deep-blue", name: "Deep Blue", rarity: "uncommon", cost: 75, corals: ["#5aa6e8", "#3f7fd1", "#7fc4f0", "#2e5ea8"], label: "rgba(190,226,255,.9)" },
  { id: "neon-reef", name: "Neon Reef", rarity: "rare", cost: 250, corals: ["#33ffd5", "#ff4bd8", "#7a5bff", "#f8ff45"], label: "rgba(220,255,244,.95)" },
  { id: "sunken-temple", name: "Sunken Temple", rarity: "epic", cost: 500, corals: ["#d9c98f", "#a68b52", "#7f6b3a", "#c2b280"], label: "rgba(244,232,193,.9)" },
  { id: "bioluminescent-reef", name: "Bioluminescent Reef", rarity: "legendary", cost: 800, corals: ["#6affc9", "#3ee0ff", "#a06bff", "#c4ff5e"], label: "rgba(214,255,240,.95)" },
];

export const findSkin = (id: string) => SKINS.find((skin) => skin.id === id) ?? SKINS[0];
export const findTheme = (id: string) => THEMES.find((theme) => theme.id === id) ?? THEMES[0];

/** Reef Tokens to USD: 50 tokens = $1.00, capped at $2.99 per cosmetic. */
export const realMoneyPrice = (reefTokenCost: number): string => {
  if (reefTokenCost <= 0) return "Free";
  const price = Math.min(reefTokenCost / 50, 2.99);
  return `$${price.toFixed(2)}`;
};
