# Voltraptor

A neon endless runner in the spirit of the Chrome offline dinosaur — rebuilt with a
proper game feel layer. One self-contained HTML file, no dependencies, no build step.

**Play it:** open `index.html` in any modern browser.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Jump (hold for height) | `Space` / `↑` / `W` | tap the left ~2/3 of the screen |
| Double jump | press again mid-air | tap again mid-air |
| Slide / fast-fall | `↓` / `S` | hold the right ~1/3 of the screen |
| Overdrive | `Shift` / `E` | the `BOOST` button |
| Pause · Retry · Mute | `P`/`Esc` · `R` · `M` | on-screen buttons |

## What's in it

- **Movement with weight** — variable-height jump, double jump, coyote time, a jump
  buffer, fast-fall, squash-and-stretch, and a procedural run cycle driven by two-bone IK
  so the feet actually plant on the ground.
- **Five obstacle types** — crystal spikes, rolling sawblades, hovering drones (jump one
  height, slide under another), plasma gates, and chasms you clear with a double jump.
  The spawn director unlocks them by distance and gaps them by current speed, so every
  pattern stays clearable.
- **Orbs, combos, near-misses** — skimming an obstacle without hitting it pays out; the
  multiplier climbs to 5x and decays if you play it safe. Orbs are placed along the jump
  arc you already have to make, and any orb that would land inside an obstacle is dropped.
- **Overdrive** — fill the meter and you get six seconds of invulnerable, faster running
  that shatters obstacles for bonus points.
- **Five biomes** that cross-fade by distance, a parallax synthwave backdrop, particles,
  screen shake, hit-stop, and a slow-motion death.
- Best score persists in `localStorage`. Scales from phones to desktop; audio is
  synthesised at runtime with WebAudio, so there are no asset files.

## Notes

Everything is drawn with the Canvas 2D API. Glow is pre-rendered into cached sprites
rather than using `shadowBlur`, which keeps it at 60fps on modest hardware.
