import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsNodeMaterial,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGPURenderer,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { color } from 'three/tsl';
import { TigerController } from './TigerController';

interface StartOptions {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  message: HTMLElement;
  toggle: HTMLButtonElement;
}

function requiredNode(root: Object3D, name: string) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Tiger model is missing node: ${name}`);
  return node;
}

async function loadTiger() {
  const gltf = await new GLTFLoader().loadAsync('/models/tiger.glb');
  const model = gltf.scene;
  model.name = 'TigerModel';
  model.traverse((object) => {
    object.userData.tiger = true;
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.frustumCulled = true;
    }
  });

  const root = new Group();
  root.name = 'interactive-tiger';
  root.add(model);
  const eyes = [requiredNode(model, 'Eye_L'), requiredNode(model, 'Eye_R')];
  eyes.forEach((eye) => { eye.userData.baseScaleY = eye.scale.y; });

  return {
    root,
    rig: {
      root,
      head: requiredNode(model, 'HeadRig'),
      body: requiredNode(model, 'BodyRig'),
      tail: requiredNode(model, 'TailRig'),
      frontLeft: requiredNode(model, 'FrontPaw_L'),
      frontRight: requiredNode(model, 'FrontPaw_R'),
      eyes,
    },
  };
}

function buildParticles() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  for (let index = 0; index < 110; index += 1) {
    positions.push((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, -2 - Math.random() * 4);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsNodeMaterial({ size: 0.018, transparent: true, opacity: 0.4 });
  material.colorNode = color('#f59e42');
  return new Points(geometry, material);
}

export async function startTigerScene({ stage, canvas, message, toggle }: StartOptions) {
  const renderer = new WebGPURenderer({ canvas, alpha: true, antialias: true });
  await renderer.init();
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new AmbientLight(new Color('#ffe0bf'), 1.6));
  const key = new DirectionalLight(new Color('#fff1d8'), 3.4);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new DirectionalLight(new Color('#f59e42'), 2.2);
  rim.position.set(5, 1, -2);
  scene.add(rim);

  const { root, rig } = await loadTiger();
  scene.add(root);
  const controller = new TigerController(rig);

  const shadowMaterial = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.14 });
  shadowMaterial.colorNode = color('#000000');
  const shadow = new Mesh(new CircleGeometry(1.05, 36), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.z = -0.2;
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
    root.scale.setScalar(compact ? 0.36 : 0.66);
    root.position.x = visibleWidth / 2 - (compact ? 0.84 : 1.15);
    root.userData.baseY = -visibleHeight / 2 + (compact ? 0.14 : 0.2);
    root.position.y = root.userData.baseY;
    shadow.scale.setScalar(compact ? 0.58 : 0.76);
    shadow.position.x = root.position.x;
    shadow.position.y = root.userData.baseY + 0.05;
    message.style.right = compact ? '104px' : '210px';
    message.style.bottom = compact ? '168px' : '275px';
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
