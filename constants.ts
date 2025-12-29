
import { Theme } from './types';

export const GRID_SIZE = 5;

export const THEMES: Theme[] = [
  {
    id: 1,
    name: "CLASSIC BEIGE",
    bg: "#F9F7F2",         // Creamy paper
    board: "#BBADA0",      // Warm taupe
    slot: "#CDC1B4",       // Soft sand
    textPrimary: "#776E65", // Charcoal wood
    textSecondary: "#8F7A66",
    accent: "#8F7A66"      // Deep earth
  },
  {
    id: 2,
    name: "MIDNIGHT DARK",
    bg: "#0B0E14",         // Deep space black
    board: "#1C212B",      // Dark slate board
    slot: "#2D343F",       // Muted navy slot
    textPrimary: "#F1F5F9", // Crisp white
    textSecondary: "#94A3B8",
    accent: "#2DD4BF"      // Hyper teal
  },
  {
    id: 3,
    name: "AMETHYST NEON",
    bg: "#020617",         // Void blue
    board: "#1E1B4B",      // Deep indigo board
    slot: "#312E81",       // Electric purple slot
    textPrimary: "#FFFFFF", // Pure white
    textSecondary: "#A5B4FC",
    accent: "#F472B6"      // Cyber pink
  }
];

export const TILE_COLORS: Record<number, string> = {
  "-1": "#1F2937", // Granite/Obsidian hazard
  2: "#EEE4DA",    // Softest
  4: "#EDE0C8",
  8: "#F2B179",
  16: "#F59563",
  32: "#F67C5F",
  64: "#F65E3B",
  128: "#EDCF72",
  256: "#EDCC61",
  512: "#EDC850",
  1024: "#2DD4BF", // Teal Power
  2048: "#F472B6", // Pink Power
  4096: "#A855F7"  // Purple Legend
};
