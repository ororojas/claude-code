# Rotobox

Rotobox is a small animation app that runs in a web browser. You can use it two ways:

- **Trace a video.** Pick a clip from your camera roll, trim it, and Rotobox splits it into frames. Each frame of the video sits under your drawing like paper on a light table, so you can trace the motion frame by frame. This technique is called rotoscoping.
- **Blank animation.** Start on empty paper and draw a flipbook animation one frame at a time.

When you're done, export it as an MP4 video, an animated GIF, a ZIP of PNG frames, or a single PNG.

The whole app is one file, `index.html`. It has no build step and no server, and your work never leaves your device.

## Using it

1. Open `index.html` in a browser. It works on phones, tablets and computers.
2. Tap **Trace a video** and pick a clip, or tap **Blank animation**.
3. For a video, drag the orange handles to trim it, then pick a frame rate. 12 frames per second is the classic hand-drawn look.
4. Draw on frame 1, then step to the next frame with the arrow and draw again. A faint red ghost of the previous drawing (the onion skin) helps you keep things lined up.
5. Press play to watch it, then tap **Export**.

If your clip has sound, Rotobox keeps it. It plays along when you press play (tap the speaker in the corner of the canvas to mute it), and MP4 exports include it.

### Tools

| Tool | What it does |
| --- | --- |
| Pencil | Draws. With a stylus, pressing harder makes thicker lines. In the brush menu (the size button) you can switch to **Ink**, whose strokes taper to a point at both ends, or **Marker**, which is see-through and builds up where strokes overlap. |
| Eraser | Erases your drawing. It never touches the video underneath. |
| Fill | Tap an empty area to fill it under your lines, or tap a filled area to recolor it. |
| Shapes | Drag to draw a line, rectangle or ellipse. Tap the button again to switch shapes. Lines snap level or upright when you're close. |
| Lasso | Draw a loop around part of a frame, then drag it, resize it from the corner handle, rotate it from the top handle, flip it or delete it. **Select all** grabs the whole frame. |
| Color | Pick a swatch, mix your own, or use **Pick a color from the canvas** to grab one from your drawing or the video. |

The **⋯** button next to the filmstrip has frame options: insert, duplicate, copy and paste a drawing, reorder, clear, delete, and **Hold this drawing** (1× to 4×), which keeps a drawing on screen for extra beats without copying it. Held frames show a ×2-style badge in the filmstrip, and holds carry into playback and every export.

For traced clips, the frame options also have **Auto-sketch from the video**. It finds the edges in the video frame and draws them as real strokes in your current color and brush, for one frame or every frame. Pick how much detail and how heavy the lines are, check the preview, then keep, erase or trace over the result. One undo takes back a whole run.

The sliders button opens the **light table** settings: video opacity, onion skin frames before and after, ghost strength, paper color, and stylus-only mode.

### Gestures and shortcuts

On a touch screen:

- Pinch to zoom and pan. Twist two fingers to rotate the canvas, like turning paper on a desk. It snaps back to straight when you're close, and the corner chip resets it.
- Tap with two fingers to undo, three fingers to redo.
- If you draw with a stylus (like an Apple Pencil), Rotobox switches to stylus-only mode so your hand and fingers can rest on the screen and move the canvas without leaving marks.

On a keyboard:

| Key | Action |
| --- | --- |
| `B` / `E` / `G` / `U` / `I` | Pencil / eraser / fill / shapes / color picker |
| `Shift` while drawing a shape | Square, circle, or a line at 45° steps |
| `L` | Lasso select. With a selection: arrow keys nudge it (`Shift` for 10 px), `Enter` keeps it, `Delete` removes it, `Esc` cancels |
| `[` and `]` | Smaller / bigger brush |
| `←` `→` | Previous / next frame |
| `Space` | Play or pause (hold and drag to pan) |
| `N` | Insert a frame after this one |
| `H` | Cycle the hold of this frame (1× to 4×) |
| `O` / `V` | Onion skin / video on or off |
| `Ctrl+Z`, `Ctrl+Shift+Z` | Undo / redo |
| `0`, `+`, `-` | Fit to screen / zoom in / zoom out |
| `R` | Straighten a rotated canvas |

## Saving to your camera roll

After an export, tap **Save to device**. On an iPhone or iPad this opens the share sheet, where **Save Video** or **Save Image** puts the file in Photos. On a computer the file downloads.

Projects are saved automatically in your browser's storage on that device. Clearing your browser data deletes them, so keep backups of anything you care about.

## Backups

On the home screen, tap **⋯** on an animation and choose **Save a backup file**. You get one `.rotobox.zip` with every frame, drawing, hold, the video frames, the sound and your settings. Keep it in Files, iCloud Drive or anywhere else. To bring it back, on this device or another one, tap **Restore a backup** on the home screen and pick the file.

## Running your own copy

Any static web host works, since it's a single HTML file. For example, with GitHub Pages:

1. In the repository settings, open **Pages**.
2. Set the source to the branch that has this folder.
3. Open `https://<your-user>.github.io/<repo>/rotobox/` on your phone, then use **Add to Home Screen** to get an app icon.

To try it locally, run `python3 -m http.server` inside this folder and open `http://localhost:8000`.

## Browser support

- Video import uses the browser's own video player, so it opens whatever your browser can play. That includes iPhone HEVC clips in Safari. If that route fails, Rotobox tries again with WebCodecs.
- MP4 export uses WebCodecs (Safari 16.4+, Chrome, Edge) and falls back to recording the canvas with MediaRecorder. GIF, ZIP and PNG export work everywhere.
- The fonts and the [Mediabunny](https://mediabunny.dev/) library (used for MP4 export and the WebCodecs import route) load from public CDNs. Without a network connection, the app still draws, plays and exports GIFs.

## How it works

Each frame stores its drawing as a list of operations (strokes and fills) rather than pixels. Undo is just a step back in that list, and frames stay sharp at any export size. Strokes are smoothed with quadratic curves between point midpoints, and fills are stored as runs of pixels so they replay quickly. Video frames are kept as JPEGs in IndexedDB and decoded only when they're on screen, which keeps memory low on phones. The GIF encoder (palette, LZW compression and frame cropping) and the ZIP writer are built in, so exports don't need a server.
