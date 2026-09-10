/**
 * Keyboard / mouse state with pointer-lock mouse look.
 *
 * Mouse movement is accumulated between frames and consumed by the game loop,
 * so a frame that takes longer than one mouse event still applies every bit of
 * motion exactly once.
 *
 * Pointer lock is not always available — a sandboxed iframe may withhold it,
 * and some browsers refuse it outside a user gesture. When it fails, the input
 * falls back to drag-to-look: the same motion is accumulated while a mouse
 * button is held. Break and place also have keyboard aliases so they stay
 * reachable when the mouse is busy steering.
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
    /** True when pointer lock is unavailable and drag-to-look is in use. */
    this.dragLook = false;
    this.onLockChange = () => {};
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._lockAttempt = null;
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
      if (this.dragLook) {
        // Left-drag steers the camera; right-click still places a block.
        this._dragging = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        if (e.button === 2) {
          this.mouseDown.right = true;
          this.clicked.right = true;
        }
        return;
      }
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
      this._dragging = false;
      if (e.button === 0) this.mouseDown.left = false;
      if (e.button === 2) this.mouseDown.right = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
        return;
      }
      if (this.dragLook && this._dragging) {
        // movementX/Y is unreliable without a lock, so difference the position.
        this.mouseDX += e.clientX - this._lastX;
        this.mouseDY += e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.pointerLocked && !this.dragLook) return;
        e.preventDefault();
        this.wheelDelta += e.deltaY;
      },
      { passive: false }
    );

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (this.pointerLocked) {
        this.dragLook = false;
        clearTimeout(this._lockAttempt);
      }
      this.onLockChange(this.pointerLocked);
    });

    // A refused request fires this instead of pointerlockchange.
    document.addEventListener('pointerlockerror', () => this._fallbackToDragLook());
  }

  /** Give up on pointer lock and drive the camera by dragging instead. */
  _fallbackToDragLook() {
    clearTimeout(this._lockAttempt);
    if (this.pointerLocked || this.dragLook) return;
    this.dragLook = true;
    this.onLockChange(true);
  }

  /** Register a callback fired once per physical key press (no auto-repeat). */
  onKey(code, handler) {
    this.keyHandlers.set(code, handler);
  }

  requestPointerLock() {
    if (this.pointerLocked) return;
    if (this.dragLook) {
      this.onLockChange(true);
      return;
    }
    try {
      const result = this.canvas.requestPointerLock();
      // Newer browsers return a promise that rejects when the request is denied.
      if (result && typeof result.catch === 'function') {
        result.catch(() => this._fallbackToDragLook());
      }
    } catch {
      this._fallbackToDragLook();
      return;
    }
    // Some environments neither resolve nor fire an error; time the attempt out.
    clearTimeout(this._lockAttempt);
    this._lockAttempt = setTimeout(() => {
      if (!this.pointerLocked) this._fallbackToDragLook();
    }, 600);
  }

  /** Release the cursor, whichever look mode is active. */
  releasePointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
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
