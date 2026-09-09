/**
 * Keyboard / mouse state with pointer-lock mouse look.
 *
 * Mouse movement is accumulated between frames and consumed by the game loop,
 * so a frame that takes longer than one mouse event still applies every bit of
 * motion exactly once.
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    /** Buttons currently held. */
    this.mouseDown = { left: false, right: false };
    /** Buttons pressed since the last consumeClicks(). */
    this.clicked = { left: false, right: false };
    this.pointerLocked = false;
    this.onLockChange = () => {};
    /** One-shot handlers by key code, for actions that must not auto-repeat. */
    this.keyHandlers = new Map();

    this._bind();
  }

  _bind() {
    const { canvas } = this;

    window.addEventListener('keydown', (e) => {
      // Space and the arrow keys scroll the page unless we claim them.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(e.code);
      const handler = this.keyHandlers.get(e.code);
      if (handler) handler();
    });

    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Losing focus mid-key would otherwise leave the player walking forever.
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown.left = false;
      this.mouseDown.right = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) {
        this.mouseDown.left = true;
        this.clicked.left = true;
      }
      if (e.button === 2) {
        this.mouseDown.right = true;
        this.clicked.right = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown.left = false;
      if (e.button === 2) this.mouseDown.right = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.pointerLocked) return;
        e.preventDefault();
        this.wheelDelta += e.deltaY;
      },
      { passive: false }
    );

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this.onLockChange(this.pointerLocked);
    });
  }

  /** Register a callback fired once per physical key press (no auto-repeat). */
  onKey(code, handler) {
    this.keyHandlers.set(code, handler);
  }

  requestPointerLock() {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** Read and reset accumulated mouse motion. */
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  /** Read and reset accumulated wheel motion. */
  consumeWheel() {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  /** Read and reset one-shot click flags. */
  consumeClicks() {
    const c = { left: this.clicked.left, right: this.clicked.right };
    this.clicked.left = false;
    this.clicked.right = false;
    return c;
  }
}
