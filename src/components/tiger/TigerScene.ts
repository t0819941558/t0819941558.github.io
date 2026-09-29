import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  MeshToonNodeMaterial,
  PerspectiveCamera,
  Points,
  PointsNodeMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  WebGPURenderer,
} from 'three/webgpu';
import { color } from 'three/tsl';
import { TigerController } from './TigerController';

interface StartOptions {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  message: HTMLElement;
  toggle: HTMLButtonElement;
}

type ToonMaterial = InstanceType<typeof MeshToonNodeMaterial>;

function toon(hex: string): ToonMaterial {
  const material = new MeshToonNodeMaterial();
  material.colorNode = color(hex);
  return material;
}

function sphere(material: ToonMaterial, scale: [number, number, number]) {
  const mesh = new Mesh(new SphereGeometry(0.5, 20, 14), material);
  mesh.scale.set(...scale);
  return mesh;
}

function buildTiger() {
  const orange = toon('#e9822c');
  const light = toon('#ffe0ad');
  const dark = toon('#2a1c17');
  const white = toon('#fffaf0');
  const pink = toon('#d97778');

  const root = new Group();
  root.name = 'interactive-tiger';
  root.userData.baseY = -1.65;
  root.position.y = root.userData.baseY;

  const body = new Group();
  body.position.y = 0.15;
  root.add(body);

  const torso = sphere(orange, [1.12, 0.82, 0.72]);
  torso.rotation.z = -0.08;
  body.add(torso);

  const belly = sphere(light, [0.58, 0.62, 0.73]);
  belly.position.set(0.05, -0.15, 0.22);
  body.add(belly);

  const head = new Group();
  head.position.set(-0.16, 0.9, 0.08);
  root.add(head);

  const face = sphere(orange, [0.75, 0.66, 0.62]);
  head.add(face);

  const muzzleLeft = sphere(light, [0.31, 0.23, 0.2]);
  muzzleLeft.position.set(-0.2, -0.14, 0.5);
  head.add(muzzleLeft);
  const muzzleRight = muzzleLeft.clone();
  muzzleRight.position.x = 0.2;
  head.add(muzzleRight);

  const nose = sphere(pink, [0.13, 0.085, 0.09]);
  nose.position.set(0, -0.05, 0.68);
  head.add(nose);

  const earGeometry = new ConeGeometry(0.27, 0.48, 4);
  const leftEar = new Mesh(earGeometry, orange);
  leftEar.position.set(-0.48, 0.5, 0);
  leftEar.rotation.z = -0.22;
  head.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.48;
  rightEar.rotation.z = 0.22;
  head.add(rightEar);

  const eyes = [-1, 1].map((side) => {
    const eye = sphere(white, [0.13, 0.16, 0.08]);
    eye.position.set(side * 0.27, 0.13, 0.56);
    eye.userData.baseScaleY = eye.scale.y;
    const pupil = sphere(dark, [0.055, 0.09, 0.045]);
    pupil.position.z = 0.065;
    eye.add(pupil);
    head.add(eye);
    return eye;
  });

  const headStripes = [-0.24, 0, 0.24].map((x, index) => {
    const stripe = new Mesh(new ConeGeometry(0.075, 0.34 - Math.abs(index - 1) * 0.06, 3), dark);
    stripe.position.set(x, 0.48, 0.54);
    stripe.rotation.x = Math.PI / 2;
    stripe.rotation.z = Math.PI;
    head.add(stripe);
    return stripe;
  });

  const legGeometry = new CylinderGeometry(0.17, 0.2, 0.75, 12);
  const frontLeft = new Mesh(legGeometry, orange);
  frontLeft.position.set(-0.52, -0.55, 0.35);
  frontLeft.rotation.z = -0.08;
  body.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = 0.52;
  frontRight.rotation.z = 0.08;
  body.add(frontRight);

  for (const leg of [frontLeft, frontRight]) {
    const paw = sphere(light, [0.22, 0.14, 0.28]);
    paw.position.y = -0.38;
    paw.position.z = 0.08;
    leg.add(paw);
  }

  const tail = new Group();
  tail.position.set(0.9, 0.2, -0.05);
  tail.rotation.z = -0.65;
  body.add(tail);
  let tailParent = tail;
  for (let index = 0; index < 5; index += 1) {
    const segment = new Mesh(new CylinderGeometry(0.12 - index * 0.012, 0.13 - index * 0.012, 0.48, 10), index % 2 === 1 ? dark : orange);
    segment.position.y = 0.22;
    segment.rotation.z = -0.25;
    tailParent.add(segment);
    const joint = new Group();
    joint.position.y = 0.43;
    segment.add(joint);
    tailParent = joint;
  }

  [-0.48, 0, 0.48].forEach((x, index) => {
    const stripe = new Mesh(new ConeGeometry(0.09, index === 1 ? 0.42 : 0.32, 3), dark);
    stripe.position.set(x, 0.5 - Math.abs(index - 1) * 0.08, 0.37);
    stripe.rotation.set(Math.PI / 2, 0, Math.PI);
    body.add(stripe);
  });

  root.traverse((object) => {
    object.userData.tiger = true;
  });

  return { root, rig: { root, head, body, tail, frontLeft, frontRight, eyes }, headStripes };
}

function buildParticles() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  for (let index = 0; index < 130; index += 1) {
    positions.push((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, -2 - Math.random() * 4);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsNodeMaterial({ size: 0.018, transparent: true, opacity: 0.45 });
  material.colorNode = color('#f59e42');
  return new Points(geometry, material);
}

export async function startTigerScene({ stage, canvas, message, toggle }: StartOptions) {
  const renderer = new WebGPURenderer({ canvas, alpha: true, antialias: true });
  await renderer.init();
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new AmbientLight(new Color('#ffd7ae'), 2.4));
  const key = new DirectionalLight(new Color('#fff1d8'), 5.2);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new DirectionalLight(new Color('#f59e42'), 3.5);
  rim.position.set(5, 1, -2);
  scene.add(rim);

  const { root, rig } = buildTiger();
  scene.add(root);
  const controller = new TigerController(rig);

  const shadowMaterial = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.16 });
  shadowMaterial.colorNode = color('#000000');
  const shadow = new Mesh(new CircleGeometry(0.9, 32), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -2.1, -0.2);
  scene.add(shadow);

  const particles = buildParticles();
  scene.add(particles);

  let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = document.visibilityState === 'visible';
  let lastTime = performance.now();
  let messageTimer = 0;
  const pointer = new Vector2(2, 2);
  const raycaster = new Raycaster();
  const greetings = ['在想什么？', '再往深处看看。', '嗷呜，发现新问题！', '先记录，再慢慢想。'];

  function showMessage(text: string) {
    message.textContent = text;
    message.classList.add('visible');
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => message.classList.remove('visible'), 2400);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 720 ? 1.25 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const visibleWidth = visibleHeight * camera.aspect;
    const compact = width < 720;
    root.scale.setScalar(compact ? 0.74 : 0.92);
    root.position.x = visibleWidth / 2 - (compact ? 0.9 : 1.25);
    root.userData.baseY = -visibleHeight / 2 + (compact ? 0.85 : 1.35);
    root.position.y = root.userData.baseY;
    shadow.position.x = root.position.x;
    shadow.position.y = root.userData.baseY - 0.42;
    message.style.right = compact ? '118px' : '220px';
    message.style.bottom = compact ? '175px' : '285px';
  }

  function setPointer(event: PointerEvent) {
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / innerHeight) * 2 + 1;
    controller.setPointer(pointer.x, pointer.y, performance.now());
  }

  function react(event: PointerEvent) {
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(root, true).some((entry) => entry.object.userData.tiger);
    if (!hit) return;
    controller.react(performance.now());
    showMessage(greetings[Math.floor(Math.random() * greetings.length)]);
  }

  function frame(time: number) {
    if (!visible) return;
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    if (running) {
      controller.update(time, delta);
      particles.rotation.z += delta * 0.012;
    }
    renderer.render(scene, camera);
  }

  toggle.addEventListener('click', () => {
    running = !running;
    toggle.querySelector('span')!.textContent = running ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', running ? '暂停背景动画' : '继续背景动画');
    showMessage(running ? '继续出发。' : '休息一下。');
  });
  window.addEventListener('pointermove', setPointer, { passive: true });
  window.addEventListener('pointerdown', react, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    if (visible) {
      lastTime = performance.now();
      renderer.setAnimationLoop(frame);
    } else {
      renderer.setAnimationLoop(null);
    }
  });

  resize();
  renderer.setAnimationLoop(frame);
  window.setTimeout(() => showMessage('你好，我是这里的小老虎。'), 900);
}
