
import React, { useState, useEffect } from 'react';
import { Settings, RotateCcw, Volume2, VolumeX, X, Trophy, Share2, ShieldAlert } from 'lucide-react';
import { THEMES, GRID_SIZE, TILE_COLORS } from './constants';
import { TileValue, Point } from './types';
import { audioService } from './services/audioService';

interface Explosion {
  id: number;
  x: number;
  y: number;
  color: string;
}

const App: React.FC = () => {
  // --- State Initialization ---
  const [grid, setGrid] = useState<TileValue[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('core_flux_save');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          return data.bestScore || 0;
        } catch (e) {
          console.error("Failed to load best score", e);
        }
      }
    }
    return 0;
  });
  const [nextTile, setNextTile] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);
  const [sfxOn, setSfxOn] = useState(true);
  const [lastMergePos, setLastMergePos] = useState<{ x: number, y: number } | null>(null);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const currentTheme = THEMES[themeIndex];

  // Add this utility function before the App component
  function getContrastColor(hexColor: string): string {
    // If the hex color is in short format, convert it to full format
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);

    // Calculate relative luminance (per ITU-R BT.709)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem('core_flux_save');
    if (saved) {
      const data = JSON.parse(saved);
      setBestScore(data.bestScore || 0);
      setThemeIndex(data.themeIndex ?? 0);
      setSfxOn(data.sfxOn ?? true);
      setDontShowAgain(data.dontShowGuideAgain ?? false);
      setShowGuide(!(data.dontShowGuideAgain ?? false));
    } else {
      setShowGuide(true);
    }

    generateNextTile(0);
    setHasLoaded(true); // 🔑
  }, []);


  useEffect(() => {
    if (!hasLoaded) return;

    localStorage.setItem('core_flux_save', JSON.stringify({
      bestScore,
      themeIndex,
      sfxOn,
      dontShowGuideAgain: dontShowAgain
    }));
  }, [bestScore, themeIndex, sfxOn, dontShowAgain, hasLoaded]);


  // --- Game Logic ---
  const generateNextTile = (currentScore: number) => {
    const rand = Math.random();
    if (currentScore > 5000) {
      if (rand < 0.4) setNextTile(2);
      else if (rand < 0.7) setNextTile(4);
      else if (rand < 0.9) setNextTile(8);
      else setNextTile(16);
    } else if (currentScore > 2000) {
      if (rand < 0.5) setNextTile(2);
      else if (rand < 0.8) setNextTile(4);
      else setNextTile(8);
    } else {
      setNextTile(rand < 0.7 ? 2 : 4);
    }
  };

  const triggerExplosion = (x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    setExplosions(prev => [...prev, { id, x, y, color }]);
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== id));
    }, 1000);
  };

  const checkGameOver = (currentGrid: TileValue[][]) => {
    const isFull = currentGrid.every(row => row.every(cell => cell !== null));
    if (isFull) {
      setGameOver(true);
    }
  };

  const resetGame = () => {
    setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    setScore(0);
    setGameOver(false);
    setExplosions([]);
    generateNextTile(0);
  };

  const handleShare = async (customScore?: number) => {
    const scoreToShare = customScore ?? score;
    const shareData = {
      title: 'CORE FLUX',
      text: `I just hit ${scoreToShare} in CORE FLUX! ⚡️ Can you stabilize the grid?`,
      url: window.location.href,
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { }
    } else {
      const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
      window.open(xUrl, '_blank');
    }
  };

  const handlePlaceTile = (x: number, y: number) => {
    if (grid[y][x] !== null || gameOver || isSettingsOpen) return;

    if (sfxOn) audioService.playPlace();

    const newGrid = grid.map(row => [...row]);
    newGrid[y][x] = nextTile;

    let currentScoreAdd = 0;
    let hasMerged = false;
    let mergeCoords: { x: number, y: number } | null = null;
    let shatteredStones: Point[] = [];

    const resolveMerges = (px: number, py: number, gridToMutate: TileValue[][]) => {
      const val = gridToMutate[py][px];
      if (val === null || val === -1) return;

      const neighbors: Point[] = [
        { x: px, y: py - 1 }, { x: px, y: py + 1 },
        { x: px - 1, y: py }, { x: px + 1, y: py }
      ].filter(p =>
        p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE
      );

      const matches = neighbors.filter(p => gridToMutate[p.y][p.x] === val);

      if (matches.length > 0) {
        hasMerged = true;
        mergeCoords = { x: px, y: py };

        matches.forEach(n => {
          gridToMutate[n.y][n.x] = null;
          currentScoreAdd += val;
        });

        const newValue = val * 2;
        gridToMutate[py][px] = newValue;
        currentScoreAdd += newValue;

        neighbors.forEach(n => {
          if (gridToMutate[n.y][n.x] === -1) {
            gridToMutate[n.y][n.x] = null;
            shatteredStones.push(n);
          }
        });

        triggerExplosion(px, py, TILE_COLORS[newValue] || '#fff');
        resolveMerges(px, py, gridToMutate);
      }
    };

    resolveMerges(x, y, newGrid);

    shatteredStones.forEach(stone => {
      triggerExplosion(stone.x, stone.y, "#555");
    });

    if (hasMerged) {
      if (sfxOn) audioService.playMerge();
      setLastMergePos(mergeCoords);
      setTimeout(() => setLastMergePos(null), 250);
    }

    if (score > 2000 && Math.random() < 0.08) {
      const emptyCells: Point[] = [];
      newGrid.forEach((r, ry) => r.forEach((c, rx) => {
        if (c === null) emptyCells.push({ x: rx, y: ry });
      }));
      if (emptyCells.length > 5) {
        const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        newGrid[target.y][target.x] = -1;
      }
    }

    const finalScore = score + currentScoreAdd;
    setScore(finalScore);
    if (finalScore > bestScore) {
      const newBestScore = Math.max(finalScore, bestScore);
      setBestScore(newBestScore);
    }

    setGrid(newGrid);
    generateNextTile(finalScore);
    checkGameOver(newGrid);
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    if (dontShowAgain) {
      localStorage.setItem('core_flux_save', JSON.stringify({
        bestScore,
        themeIndex,
        sfxOn,
        dontShowGuideAgain: true
      }));
    }
  };

  const renderTile = (val: TileValue, x: number, y: number) => {
    if (val === null) {
      return (
        <div
          key={`slot-${x}-${y}`}
          onClick={() => handlePlaceTile(x, y)}
          className="w-full h-full rounded-md sm:rounded-lg transition-colors cursor-pointer group flex items-center justify-center relative overflow-hidden"
          style={{ backgroundColor: currentTheme.slot }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: currentTheme.accent }} />
          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full opacity-0 group-hover:opacity-40 bg-white" />
        </div>
      );
    }

    const isStone = val === -1;
    const bgColor = TILE_COLORS[val] || '#333';
    const textColor = isStone ? "#fff" : (val <= 4 ? "#776e65" : "#ffffff");
    const isNewMerged = lastMergePos?.x === x && lastMergePos?.y === y;
    const textSize = val > 99 ? 'text-sm sm:text-base' : val > 9 ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl';

    return (
      <div
        key={`tile-${x}-${y}-${val}`}
        className={`w-full h-full rounded-md sm:rounded-lg flex items-center justify-center font-black shadow-md transform transition-all ${textSize}
          ${'animate-in zoom-in duration-300'}
          ${isStone ? 'border border-white/10 shadow-inner' : ''}`}
        style={{
          backgroundColor: isStone ? (themeIndex === 0 ? "#4B5563" : "#111827") : bgColor,
          color: textColor,
          boxShadow: isNewMerged ? `0 0 20px ${currentTheme.accent}44` : 'none'
        }}
      >
        {isStone ? '✕' : val}
      </div>
    );
  };

  const getPhase = () => {
    if (score > 5000) return { label: "PHASE: CRITICAL", color: currentTheme.accent };
    if (score > 2000) return { label: "PHASE: UNSTABLE", color: "#f59e0b" };
    return { label: "PHASE: STABLE", color: "#10b981" };
  };



  return (
    <div
      className="min-h-screen w-full flex flex-col items-center p-2 sm:p-4 transition-colors duration-500 overflow-hidden"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.textPrimary }}
    >
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 sm:mb-6 mt-2 sm:mt-4 px-2 sm:px-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter leading-tight italic" style={{ color: currentTheme.accent }}>
            CORE FLUX
          </h1>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: getPhase().color }} />
            <span className="text-[10px] font-black tracking-[0.2em] opacity-60 uppercase">{getPhase().label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-2xl hover:brightness-110 shadow-sm"
            style={{ backgroundColor: currentTheme.slot }}
          >
            <Settings size={22} style={{ color: currentTheme.textPrimary }} />
          </button>
        </div>
      </div>

      {/* Stats - ENLARGED LABELS AND VALUES */}
      <div className="w-full max-w-md grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-8 px-2 sm:px-0">
        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group border border-white/5" style={{ backgroundColor: currentTheme.slot }}>
          <span className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] opacity-50 mb-0.5 sm:mb-1" style={{ color: currentTheme.textPrimary }}>Score</span>
          <span className="text-2xl sm:text-4xl md:text-5xl font-black leading-none tabular-nums">{score}</span>
        </div>
        <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-lg relative overflow-hidden border border-white/5" style={{ backgroundColor: currentTheme.slot }}>
          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
            <Trophy size={12} sm:size={14} color="#FFD700" fill="#FFD700" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] opacity-50" style={{ color: currentTheme.textPrimary }}>Best</span>
          </div>
          <span className="text-2xl sm:text-4xl md:text-5xl font-black leading-none tabular-nums">{bestScore}</span>
          <button
            onClick={() => handleShare(bestScore)}
            className="absolute top-2 right-2 p-1.5 opacity-70 hover:opacity-100 bg-black/20 rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current"
            aria-label="Share best score"
            title="Share your best score"
            style={{ color: currentTheme.textPrimary }}
          >
            <Share2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Next Tile Preview */}
      <div className="w-full max-w-md flex justify-between items-end mb-4 sm:mb-6 px-2">
        <div className="flex flex-col gap-1 sm:gap-2">
          <span className="text-[10px] sm:text-xs font-black opacity-50 tracking-widest" style={{ color: currentTheme.textPrimary }}>NEXT FLUX</span>
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-black shadow-xl border-2 sm:border-4 transition-all duration-300"
            style={{
              backgroundColor: TILE_COLORS[nextTile],
              color: nextTile <= 4 ? "#776e65" : "#ffffff",
              borderColor: currentTheme.accent
            }}
          >
            {nextTile}
          </div>
        </div>

        <button
          onClick={resetGame}
          className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm tracking-widest shadow-lg hover:brightness-110"
          style={{ backgroundColor: currentTheme.accent, color: '#fff' }}
        >
          <RotateCcw size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">RESET</span>
        </button>
      </div>

      {/* Game Board */}
      <div
        className="w-full max-w-[90vw] sm:max-w-md aspect-square rounded-2xl sm:rounded-[2rem] p-2 sm:p-4 shadow-2xl relative border-2 sm:border-4"
        style={{ backgroundColor: currentTheme.board, borderColor: currentTheme.slot }}
      >
        <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-1 sm:gap-2 relative">
          {grid.map((row, y) => row.map((val, x) => renderTile(val, x, y)))}

          {/* Explosion Layer */}
          {explosions.map(exp => (
            <div
              key={exp.id}
              className="absolute pointer-events-none"
              style={{
                left: `${(exp.x / GRID_SIZE) * 100 + (100 / GRID_SIZE / 2)}%`,
                top: `${(exp.y / GRID_SIZE) * 100 + (100 / GRID_SIZE / 2)}%`
              }}
            >
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2.5 h-2.5 rounded-full animate-particle"
                  style={{
                    backgroundColor: exp.color,
                    '--tw-translate-x': `${Math.cos(i * 45 * Math.PI / 180) * 100}px`,
                    '--tw-translate-y': `${Math.sin(i * 45 * Math.PI / 180) * 100}px`
                  } as React.CSSProperties}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl rounded-[1.8rem] flex flex-col items-center justify-center text-white animate-in fade-in zoom-in duration-500 p-8 text-center">
            <ShieldAlert size={64} className="mb-4 text-red-500" />
            <h2 className="text-5xl font-black mb-2 italic tracking-tighter uppercase">Grid Collapsed</h2>
            <p className="text-xl mb-10 font-medium opacity-60">Energy Stabilized at: {score}</p>
            <div className="flex flex-col gap-4 w-full max-w-[280px]">
              <button onClick={resetGame} className="w-full py-5 bg-white text-black rounded-2xl font-black text-xl shadow-xl">REBOOT</button>
              <button onClick={() => handleShare()} className="w-full py-4 flex items-center justify-center gap-3 rounded-2xl font-black text-lg shadow-xl border-2 border-white/20" style={{ backgroundColor: 'transparent', color: '#fff' }}><Share2 size={20} />TRANSMIT SCORE</button>
            </div>
          </div>
        )}

        {showGuide && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 relative"
              style={{ backgroundColor: currentTheme.bg, color: currentTheme.textPrimary }}
            >
              <h2 className="text-2xl font-bold mb-4">How to Play</h2>
              <div className="space-y-3 mb-6">
                <p>1. Click on an empty cell to place a tile</p>
                <p>2. Tiles with the same number merge when placed adjacent to each other</p>
                <p>3. Try to get the highest score possible!</p>
                <p>4. Special tiles (✕) cannot be merged and block adjacent cells</p>
              </div>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="dontShowAgain" className="text-sm">
                  Don't show this guide again
                </label>
              </div>
              <button
                onClick={handleCloseGuide}
                className="w-full py-3 px-4 rounded-lg font-bold transition-all duration-200
    hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2
    focus:ring-current focus:ring-offset-current/20"
                style={{
                  backgroundColor: currentTheme.accent,
                  color: getContrastColor(currentTheme.accent), // This will ensure good contrast
                  '--tw-ring-color': currentTheme.accent
                }}
                aria-label="Close the guide"
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[3rem] p-10 relative shadow-2xl border-4"
            style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.accent }}
          >
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-8 right-8 p-2 rounded-full opacity-40 hover:opacity-100"><X size={32} style={{ color: currentTheme.textPrimary }} /></button>
            <h2 className="text-4xl font-black mb-12 text-center tracking-tighter" style={{ color: currentTheme.textPrimary }}>SETTINGS</h2>
            <div className="space-y-10">
              <div className="space-y-4">
                <span className="text-[12px] font-black uppercase tracking-[0.3em] opacity-40 ml-1" style={{ color: currentTheme.textPrimary }}>Theme</span>
                <div className="grid grid-cols-3 gap-4">
                  {THEMES.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => setThemeIndex(idx)}
                      className={`h-16 rounded-[1.5rem] border-4 ${themeIndex === idx ? 'shadow-2xl' : 'opacity-80 hover:opacity-100'}`}
                      style={{
                        backgroundColor: t.bg,
                        borderColor: t.accent
                      }}
                    />
                  ))}
                </div>
                <div className="text-center text-sm font-black tracking-widest opacity-80" style={{ color: currentTheme.textPrimary }}>{THEMES[themeIndex].name}</div>
              </div>
              <div className="space-y-4">
                <span className="text-[12px] font-black uppercase tracking-[0.3em] opacity-40 ml-1" style={{ color: currentTheme.textPrimary }}>Preferences</span>
                <button className="w-full flex items-center justify-between p-5 rounded-[2rem] shadow-inner" style={{ backgroundColor: currentTheme.slot }} onClick={() => setSfxOn(!sfxOn)}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-black/20" style={{ color: currentTheme.textPrimary }}>{sfxOn ? <Volume2 size={24} /> : <VolumeX size={24} />}</div>
                    <span className="font-black text-lg tracking-tight" style={{ color: currentTheme.textPrimary }}>AUDIO FX</span>
                  </div>
                  <div className="w-16 h-9 rounded-full p-1.5 transition-colors duration-300 flex items-center relative shadow-inner" style={{ backgroundColor: sfxOn ? currentTheme.accent : '#4b5563' }}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow-lg transition-transform duration-300 transform ${sfxOn ? 'translate-x-7' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <p className="mt-auto mb-4 sm:mb-6 text-[10px] sm:text-[11px] font-black opacity-20 uppercase tracking-[0.5em] px-2 text-center">
        CORE FLUX LABS // BUILD 12.2025
      </p>
    </div>
  );
};

export default App;
