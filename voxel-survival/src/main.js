import { Game } from './game/game.js';
import { Hud } from './ui/hud.js';

/**
 * Entry point.
 *
 * The seed comes from `?seed=` when present so a world can be shared or
 * reproduced; otherwise it is random, and always surfaced in the debug overlay.
 */
function resolveSeed() {
  const param = new URLSearchParams(location.search).get('seed');
  if (param !== null && param.trim() !== '') {
    const parsed = Number(param);
    if (Number.isFinite(parsed)) return Math.floor(parsed) >>> 0;
    // Non-numeric seeds are hashed so "hello" is a valid, stable seed.
    let h = 2166136261;
    for (const ch of param) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  return (Math.random() * 0xffffffff) >>> 0;
}

function main() {
  const canvas = document.getElementById('game');
  const seed = resolveSeed();

  let game;
  try {
    game = new Game(canvas, seed);
  } catch (error) {
    console.error(error);
    // The HUD can still report the failure even if the renderer never came up.
    new Hud(document.createElement('canvas')).showError(String(error.message || error));
    return;
  }

  game.start();
  // Exposed for debugging from the console; not used by the game itself.
  window.game = game;
  console.info(`Voxel Survival — seed ${seed}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
