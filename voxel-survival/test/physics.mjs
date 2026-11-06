/**
 * Player physics: collision, gravity, jumping, fall damage, drowning.
 * Uses a stub world so each case is isolated from terrain generation.
 */
import { Player } from '../src/game/player.js';
import { BLOCK } from '../src/world/blocks.js';
import { PLAYER_HEIGHT } from '../src/config.js';

// Minimal stub world: a floor at y<40, plus arbitrary extra solid blocks.
function makeWorld(extra = new Set()) {
  return {
    getBlock(x, y, z) {
      if (y < 0) return BLOCK.BEDROCK;
      if (extra.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`)) return BLOCK.STONE;
      return y < 40 ? BLOCK.STONE : BLOCK.AIR;
    },
    surfaceHeight: () => 40,
  };
}
const NONE = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
const step = (p, n, move = NONE, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) p.update(dt, move);
};
let failures = 0;
const pass = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

// 1. Gravity settles the player exactly on the floor.
let p = new Player(makeWorld(), { x: 0.5, y: 50, z: 0.5 });
step(p, 200);
pass(
  'lands on floor at y=40',
  Math.abs(p.position[1] - 40) < 0.01,
  `y=${p.position[1].toFixed(4)}`
);
pass('onGround after landing', p.onGround === true);
pass('vertical velocity zeroed', Math.abs(p.velocity[1]) < 1e-6);

// 2. A wall blocks forward movement.
const wall = new Set();
for (let y = 40; y < 44; y++) for (let z = -3; z <= 3; z++) wall.add(`3,${y},${z}`);
p = new Player(makeWorld(wall), { x: 0.5, y: 40, z: 0.5 });
p.yaw = -Math.PI / 2; // face +X
step(p, 240, { ...NONE, forward: 1 });
pass(
  'stopped by wall before x=3',
  p.position[0] < 3 && p.position[0] > 2.5,
  `x=${p.position[0].toFixed(3)}`
);

// 3. Sliding: moving diagonally into the wall still advances along Z.
p = new Player(makeWorld(wall), { x: 0.5, y: 40, z: 0.5 });
p.yaw = -Math.PI / 2;
step(p, 240, { ...NONE, forward: 1, strafe: 1 });
pass(
  'slides along wall (z advanced)',
  Math.abs(p.position[2] - 0.5) > 3,
  `z=${p.position[2].toFixed(2)}`
);

// 4. Jump clears exactly one block but not two.
p = new Player(makeWorld(), { x: 0.5, y: 40, z: 0.5 });
step(p, 5);
let peak = p.position[1];
for (let i = 0; i < 120; i++) {
  p.update(1 / 60, { ...NONE, jump: i < 3 });
  peak = Math.max(peak, p.position[1]);
}
pass(
  'jump height clears 1 block',
  peak - 40 >= 1.0 && peak - 40 < 2.0,
  `peak=+${(peak - 40).toFixed(2)}`
);

// 5. Fall damage scales with distance; a short drop is harmless.
p = new Player(makeWorld(), { x: 0.5, y: 43, z: 0.5 });
step(p, 200);
pass('3-block drop is harmless', p.health === 20, `hp=${p.health}`);
p = new Player(makeWorld(), { x: 0.5, y: 80, z: 0.5 });
step(p, 400);
pass(
  '40-block drop is lethal',
  p.health === 0 && Math.abs(p.position[1] - 40) < 0.01,
  `hp=${p.health} y=${p.position[1].toFixed(3)}`
);

// 6. No tunneling through a 1-block-thick floor at high speed.
const thin = new Set();
for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) thin.add(`${x},60,${z}`);
p = new Player(makeWorld(thin), { x: 0.5, y: 100, z: 0.5 });
for (let i = 0; i < 600; i++) p.update(1 / 60, NONE);
pass(
  'does not tunnel through thin floor',
  Math.abs(p.position[1] - 61) < 0.01,
  `y=${p.position[1].toFixed(3)}`
);

// 7. Head clearance: jumping under a low ceiling must not clip into it.
const ceiling = new Set();
for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) ceiling.add(`${x},42,${z}`);
p = new Player(makeWorld(ceiling), { x: 0.5, y: 40, z: 0.5 });
let maxY = 40;
for (let i = 0; i < 120; i++) {
  p.update(1 / 60, { ...NONE, jump: i < 3 });
  maxY = Math.max(maxY, p.position[1]);
}
pass(
  'head stops below ceiling',
  maxY + PLAYER_HEIGHT <= 42 + 1e-3,
  `maxHead=${(maxY + PLAYER_HEIGHT).toFixed(4)}`
);

// 8. Never comes to rest embedded in geometry.
p = new Player(makeWorld(wall), { x: 0.5, y: 60, z: 0.5 });
p.yaw = -Math.PI / 2;
step(p, 600, { ...NONE, forward: 1, sprint: true });
const b = p.bounds();
let embedded = false;
for (let bx = Math.floor(b.minX); bx <= Math.floor(b.maxX); bx++)
  for (let by = Math.floor(b.minY); by <= Math.floor(b.maxY); by++)
    for (let bz = Math.floor(b.minZ); bz <= Math.floor(b.maxZ); bz++)
      if (
        makeWorld(wall).getBlock(bx, by, bz) === BLOCK.STONE &&
        bx + 1 > b.minX &&
        bx < b.maxX &&
        by + 1 > b.minY &&
        by < b.maxY &&
        bz + 1 > b.minZ &&
        bz < b.maxZ
      )
        embedded = true;
pass('never rests embedded in a block', !embedded);

// 9. Drowning: underwater the player loses breath then health.
const waterWorld = {
  getBlock: (x, y, z) => (y < 20 ? BLOCK.STONE : y < 60 ? BLOCK.WATER : BLOCK.AIR),
  surfaceHeight: () => 20,
};
p = new Player(waterWorld, { x: 0.5, y: 30, z: 0.5 });
step(p, 60 * 20);
pass('breath depletes underwater', p.breath === 0, `breath=${p.breath.toFixed(1)}`);
pass('drowning costs health', p.health < 20, `hp=${p.health}`);

// 10. A mid-height fall wounds without killing (damage scales with distance).
p = new Player(makeWorld(), { x: 0.5, y: 52, z: 0.5 });
step(p, 300);
pass('12-block drop wounds but does not kill', p.health > 0 && p.health < 20, `hp=${p.health}`);

console.log(failures === 0 ? '\nphysics: all checks passed' : `\nphysics: ${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
