# Physics simulators

Two browser apps, each running on a physics engine written for it.

| Folder | What it is |
|---|---|
| `real-physics-3d/` | **Proving Ground**, a 3D rigid-body sandbox with twelve scenarios |
| `hyperspace-4d/` | **Ana & Kata**, a puzzle game set in four dimensions |
| `tests/` | Node tests that hold both engines to textbook results |

## Running them

Open `physics-simulators/index.html`, or either app's own `index.html`, in a current browser. Opening the file straight from disk works. You can also serve the folder:

```sh
cd physics-simulators
python3 -m http.server 8000
# then visit http://localhost:8000
```

There is no build step. Each app loads Three.js r170 from cdnjs and its fonts from Google Fonts, so it needs a network connection.

## Proving Ground (3D)

A test range for real-world physics. Every object uses a real material at its real density, from polystyrene foam at 30 kg/m³ up to gold at 19,300.

**Controls**

- Drag empty space to orbit. Right-drag or use two fingers to pan. Scroll or pinch to zoom.
- Tools: `1` Grab, `2` Spawn, `3` Launch, `4` Blast, `5` Erase.
- `Space` pauses. `.` steps one frame while paused. `R` resets the scenario.
- `F` follows the selected object, `Delete` removes it and `Esc` lets go of it.

**Scenarios:** open range (with a bounce test), domino run, Jenga tower, Newton's cradle, pendulum wave, wrecking ball, bowling lane with an oil pattern, incline race, Galileo drop, floating and sinking, zero-g spin, castle siege.

**Worlds:** Earth, Moon, Mars, Venus, Jupiter, Titan and orbit, each with its own gravity and air density. On Venus, foam floats up through the air.

**Engine** (`engine.js`, no dependencies, runs in Node and the browser)

- Bodies built from spheres and boxes, compounds included. Mass and inertia come from density and shape, and hollow shells are supported.
- Contacts: sphere and box pairs, with box-box contacts from the separating axis test, face clipping and edge-edge contacts. Up to four points per manifold, warm started.
- Solver: sub-stepped soft constraints in the style of Box2D v3, with a relax pass and restitution applied after the substeps.
- Coulomb friction, plus rolling resistance so balls coast to a stop.
- Rotation uses an implicit-midpoint gyroscopic step. A free body keeps its energy and angular momentum, so a spinning box shows the Dzhanibekov flip.
- Quadratic air drag, wind, and buoyancy in air and water. "Ghost" volumes let a steel hull displace water and float.
- Ball, rod, rope, spring and bungee joints, and a soft grab joint for the mouse.
- Islands of resting bodies go to sleep.

## Ana & Kata (4D)

You are a hypersphere in a 4D world, and the screen shows the 3D slice of that world passing through your centre. The fourth direction is w. Its two ways are called ana (+w) and kata (−w).

Move along w and the slice changes: a wall that only spans part of w fades away, and a bridge that sits at another w fades in. Things just off the slice show as ghosts, orange on the ana side and blue on the kata side. The gauge on the right plots everything along the hidden direction.

**Controls**

- `WASD` or the arrow keys roll, and `Space` jumps.
- `E` moves ana and `Q` moves kata.
- `Tab` turns the view a quarter turn into w. Forward then points along w, and z becomes the hidden direction.
- Drag to look and scroll to zoom. `R` restarts the level and `Esc` opens the menu.
- On a phone, the stick rolls and the four buttons give ana, kata, turn and jump.

**Levels:** Roll, Ana, Kata, The room, Turn, Rising, Hyperspheres, Drift, Vaults and Hypercube. Each one adds a single idea, ending inside a hollow tesseract whose way out lies in w.

**The 4D lab** drops tesseracts, 16-cells, 5-cells, 24-cells, a 3-4 duoprism and hyperspheres onto a 4D floor. Sliders move the slice through w and turn it in the xw and zw planes, so you can watch a tesseract's cross-section change from a cube to a stretched box to a hexagonal solid. Click a shape to kick it, or turn on wireframe shadows to see the whole 4D shape in perspective.

**Engine** (`engine4d.js`)

- Convex 4-polytopes built from vertex lists. The cells (3D faces) come from a search over vertex 4-subsets. Volume, centroid and inertia are exact, from a decomposition into 4-simplices.
- Orientation is a 4×4 rotation matrix. Angular velocity is a bivector with six components, one per plane of rotation (xy, xz, xw, yz, yw, zw), and inertia acts on bivectors.
- Collisions: hypersphere pairs, hypersphere against polytope through GJK on the 4D hull, and polytope pairs from vertex and edge samples tested against the other body's cells.
- A sub-stepped soft-contact solver with friction and restitution, kinematic bodies for moving platforms, and sleeping.
- Slicing: each cell is cut by the viewing hyperplane into a convex polygon, then triangulated for drawing.

## Tests

```sh
node --test physics-simulators/tests/*.test.js
```

There are 38 checks in all. The 22 for the 3D engine compare against closed-form physics: free fall, pendulum and spring periods, sliding distance, the friction angle, rolling at 5/7 g sin θ, rolling resistance, bounce heights of e², Archimedes, terminal velocity, a projectile with drag against a fine-step reference, a rising balloon, the Dzhanibekov flip with energy and angular momentum conserved, Newton's cradle, a 12-box stack, an 18-layer Jenga tower, tunnelling, overlap recovery, joint drift, an explosion and a floating steel hull.

The 16 for the 4D engine check vertex, edge and cell counts of the regular polytopes, exact volumes and moments, slice areas, GJK distances, and contact physics. One example: a sliding hypersphere ends up rolling at 3/4 of its starting speed, because a solid 4-ball's moment of inertia in any plane is m r²/3.
