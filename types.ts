
export type TileValue = number | null;

export interface Theme {
  id: number;
  name: string;
  bg: string;
  board: string;
  slot: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
}

export interface GameState {
  grid: TileValue[][];
  score: number;
  bestScore: number;
  nextTile: number;
  gameOver: boolean;
  settings: {
    musicOn: boolean;
    sfxOn: boolean;
    themeIndex: number;
  };
}

export interface Point {
  x: number;
  y: number;
}
