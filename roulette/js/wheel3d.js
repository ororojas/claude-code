import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import {
  GEO, ALPHA, POCKETS, WHEEL_ORDER, colorOf, surfaceHeight, deflectorAngle,
} from './physics.js';

const POCKET_COLORS = {
  red: ['#c0141f', '#86101a'],
  black: ['#151515', '#0b0b0b'],
  green: ['#0d8a43', '#08602f'],
};

function woodTexture(base, dark) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, base);
  grad.addColorStop(0.5, dark);
  grad.addColorStop(1, base);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 220; i++) {
    const y0 = Math.random() * 256;
    const amp = 1 + Math.random() * 5;
    const freq = 0.004 + Math.random() * 0.01;
    const ph = Math.random() * 6.28;
    g.strokeStyle = Math.random() < 0.7
      ? `rgba(25,10,2,${0.08 + Math.random() * 0.22})`
      : `rgba(255,190,120,${0.04 + Math.random() * 0.08})`;
    g.lineWidth = 0.5 + Math.random() * 2;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 16) {
      const y = y0 + Math.sin(x * freq + ph) * amp;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  return t;
}

function rotorTexture(maxAniso) {
  const S = 2048, C = S / 2, k = C / GEO.rotorR;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, S, S);

  // Canvas y points down, so canvas angles run opposite to physics angles.
  for (let i = 0; i < POCKETS; i++) {
    const a0 = i * ALPHA, a1 = (i + 1) * ALPHA;
    const [ring, floor] = POCKET_COLORS[colorOf(WHEEL_ORDER[i])];
    g.fillStyle = floor;
    g.beginPath();
    g.arc(C, C, GEO.pocketOutR * k, a0, a1);
    g.arc(C, C, GEO.pocketInR * k, a1, a0, true);
    g.fill();
    const rg = g.createRadialGradient(C, C, GEO.pocketOutR * k, C, C, GEO.rotorR * k);
    rg.addColorStop(0, ring);
    rg.addColorStop(1, shade(ring, 0.75));
    g.fillStyle = rg;
    g.beginPath();
    g.arc(C, C, GEO.rotorR * k, a0, a1);
    g.arc(C, C, GEO.pocketOutR * k, a1, a0, true);
    g.fill();
  }

  g.strokeStyle = '#d9b45a';
  g.lineWidth = 5;
  for (let i = 0; i < POCKETS; i++) {
    const a = i * ALPHA;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * GEO.pocketOutR * k, C + Math.sin(a) * GEO.pocketOutR * k);
    g.lineTo(C + Math.cos(a) * GEO.rotorR * k, C + Math.sin(a) * GEO.rotorR * k);
    g.stroke();
  }
  for (const r of [GEO.pocketOutR, GEO.rotorR - 0.004]) {
    g.lineWidth = 8;
    g.beginPath();
    g.arc(C, C, r * k, 0, Math.PI * 2);
    g.stroke();
  }

  g.fillStyle = '#fff8e8';
  g.font = 'bold 74px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < POCKETS; i++) {
    const a = (i + 0.5) * ALPHA;
    const rr = (GEO.pocketOutR + GEO.rotorR) / 2 * k;
    g.save();
    g.translate(C + Math.cos(a) * rr, C + Math.sin(a) * rr);
    g.rotate(a + Math.PI / 2);
    g.fillText(String(WHEEL_ORDER[i]), 0, 4);
    g.restore();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const gg = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${gg},${b})`;
}

function planarUV(geo, R) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / (2 * R) + 0.5;
    uv[i * 2 + 1] = -pos.getZ(i) / (2 * R) + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const lathe = (pts, seg = 160) =>
  new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Physics plane (x, y) maps to world (x, height, -y).
const toWorld = (x, y, h, out) => out.set(x, h, -y);

export class Wheel3D {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.elev = 0.95;
    this.elevTarget = 0.95;
    this.focus = 0;
    this.focusTarget = 0;

    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x0d2a1c, 0.35));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(1.2, 4.5, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -1.4;
    sc.right = sc.top = 1.4;
    sc.near = 1; sc.far = 9;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    scene.add(sun);

    this.glow = new THREE.PointLight(0xffd27a, 0, 0.6, 2);
    scene.add(this.glow);

    this.build();
    this.tmp = new THREE.Vector3();
  }

  build() {
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const scene = this.scene;

    const darkWood = new THREE.MeshPhysicalMaterial({
      map: woodTexture('#5a2a0c', '#3b1a06'),
      roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    const trackWood = new THREE.MeshPhysicalMaterial({
      map: woodTexture('#8a4b1c', '#6b3812'),
      roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
    });
    const brass = new THREE.MeshStandardMaterial({ color: 0xe0b85c, metalness: 1, roughness: 0.22 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 1, roughness: 0.12 });

    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.38 }),
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.14;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    const slope = [[GEO.rotorR + 0.004, 0.045]];
    for (let i = 0; i <= 14; i++) {
      const r = GEO.rotorR + 0.006 + (GEO.rimR - GEO.rotorR - 0.006) * (i / 14);
      slope.push([r, surfaceHeight(r)]);
    }
    const bowl = new THREE.Mesh(lathe(slope.reverse()), trackWood);
    bowl.receiveShadow = true;
    scene.add(bowl);

    const top = surfaceHeight(GEO.rimR);
    const rim = new THREE.Mesh(lathe([
      [GEO.rimR, top], [GEO.rimR, top + 0.07], [GEO.rimR + 0.03, top + 0.1],
      [1.12, top + 0.11], [1.2, top + 0.08], [1.24, top - 0.02],
      [1.24, -0.06], [1.2, -0.13], [1.0, -0.14],
    ]), darkWood);
    rim.castShadow = true;
    rim.receiveShadow = true;
    scene.add(rim);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(GEO.rimR + 0.03, 0.006, 8, 160), brass);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = top + 0.1;
    scene.add(lip);

    const diamondGeo = new THREE.OctahedronGeometry(1, 0);
    for (let j = 0; j < GEO.deflCount; j++) {
      const a = deflectorAngle(j);
      const d = new THREE.Mesh(diamondGeo, brass);
      toWorld(Math.cos(a) * GEO.deflR, Math.sin(a) * GEO.deflR, surfaceHeight(GEO.deflR) + 0.006, d.position);
      d.rotation.y = a;
      if (j % 2) d.scale.set(0.034, 0.013, 0.016);
      else d.scale.set(0.016, 0.013, 0.034);
      d.castShadow = true;
      scene.add(d);
    }

    const rotor = new THREE.Group();
    this.rotor = rotor;
    scene.add(rotor);

    const ringH = surfaceHeight(GEO.rotorR - 1e-6);
    const rotorGeo = lathe([
      [GEO.pocketInR, 0], [GEO.pocketOutR, 0], [GEO.pocketOutR, 0.02],
      [GEO.rotorR, ringH], [GEO.rotorR + 0.003, ringH - 0.02], [GEO.rotorR + 0.003, -0.03],
    ].reverse(), 222);
    planarUV(rotorGeo, GEO.rotorR);
    const rotorMesh = new THREE.Mesh(rotorGeo, new THREE.MeshPhysicalMaterial({
      map: rotorTexture(aniso), roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.25,
    }));
    rotorMesh.receiveShadow = true;
    rotor.add(rotorMesh);

    const cone = new THREE.Mesh(lathe([
      [GEO.pocketInR, 0], [GEO.pocketInR, 0.04], [0.42, 0.06], [0.3, 0.09],
      [0.18, 0.11], [0.12, 0.115], [0, 0.118],
    ]), trackWood);
    cone.castShadow = true;
    cone.receiveShadow = true;
    rotor.add(cone);

    const coneRing = new THREE.Mesh(new THREE.TorusGeometry(GEO.pocketInR, 0.006, 8, 160), brass);
    coneRing.rotation.x = Math.PI / 2;
    coneRing.position.y = 0.04;
    rotor.add(coneRing);
    const pocketRing = new THREE.Mesh(new THREE.TorusGeometry(GEO.pocketOutR, 0.004, 8, 160), brass);
    pocketRing.rotation.x = Math.PI / 2;
    pocketRing.position.y = 0.02;
    rotor.add(pocketRing);

    const fretLen = GEO.pocketOutR - GEO.pocketInR;
    const frets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(fretLen, 0.034, GEO.fretHalf * 2), chrome, POCKETS,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const mid = (GEO.pocketInR + GEO.pocketOutR) / 2;
    for (let k = 0; k < POCKETS; k++) {
      const a = -k * ALPHA;
      toWorld(Math.cos(a) * mid, Math.sin(a) * mid, 0.017, p);
      q.setFromAxisAngle(up, a);
      m.compose(p, q, one);
      frets.setMatrixAt(k, m);
    }
    frets.castShadow = true;
    frets.receiveShadow = true;
    rotor.add(frets);

    const turret = new THREE.Mesh(lathe([
      [0.13, 0.112], [0.12, 0.13], [0.07, 0.15], [0.04, 0.17], [0.032, 0.2],
      [0.03, 0.26], [0.048, 0.275], [0.052, 0.295], [0.03, 0.315], [0, 0.32],
    ], 64), brass);
    turret.castShadow = true;
    rotor.add(turret);

    const armGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.34, 16);
    const knobGeo = new THREE.SphereGeometry(0.027, 24, 16);
    for (let i = 0; i < 2; i++) {
      const arm = new THREE.Mesh(armGeo, brass);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = i * Math.PI / 2;
      arm.position.y = 0.235;
      arm.castShadow = true;
      rotor.add(arm);
    }
    for (let i = 0; i < 4; i++) {
      const knob = new THREE.Mesh(knobGeo, brass);
      const a = i * Math.PI / 2;
      knob.position.set(Math.cos(a) * 0.17, 0.235, Math.sin(a) * 0.17);
      knob.castShadow = true;
      rotor.add(knob);
    }

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(GEO.ballR, 40, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xfafaf4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04,
      }),
    );
    this.ball.castShadow = true;
    this.ball.visible = false;
    scene.add(this.ball);
  }

  setView(top) {
    this.elevTarget = top ? Math.PI / 2 - 0.001 : 0.95;
  }

  setFocus(on) {
    this.focusTarget = on ? 1 : 0;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  render(sim, dt) {
    const k = 1 - Math.exp(-dt * 3);
    this.elev += (this.elevTarget - this.elev) * k;
    this.focus += (this.focusTarget - this.focus) * (1 - Math.exp(-dt * 1.6));

    this.rotor.rotation.y = sim.wheelAngle;

    const b = sim.ball;
    this.ball.visible = !!b;
    if (b) {
      const r = Math.hypot(b.x, b.y);
      toWorld(b.x, b.y, surfaceHeight(r) + GEO.ballR + b.hop, this.ball.position);
      this.ball.rotation.x += sim.ballSpeed() * dt * 8;
    }

    const glowOn = b && b.settled;
    this.glow.intensity += ((glowOn ? 0.5 + Math.sin(performance.now() / 260) * 0.15 : 0) - this.glow.intensity) * k;
    if (b) this.glow.position.copy(this.ball.position).y += 0.12;

    const cam = this.camera;
    const vf = THREE.MathUtils.degToRad(cam.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * cam.aspect);
    const half = Math.min(vf, hf);
    let dist = 1.36 / Math.sin(half);
    const target = this.tmp.set(0, 0.04, 0);
    if (b && this.focus > 0.001) {
      target.lerp(this.ball.position, this.focus * 0.75);
      dist *= 1 - 0.45 * this.focus;
    }
    cam.position.set(
      target.x,
      target.y + Math.sin(this.elev) * dist,
      target.z + Math.cos(this.elev) * dist,
    );
    cam.lookAt(target);
    this.renderer.render(this.scene, cam);
  }
}
