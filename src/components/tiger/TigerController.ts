import type { Group, Object3D } from 'three/webgpu';

export type TigerState = 'idle' | 'look' | 'react' | 'sleep' | 'wake';

interface Rig {
  root: Group;
  head: Group;
  body: Group;
  tail: Group;
  frontLeft: Object3D;
  frontRight: Object3D;
  eyes: Object3D[];
}

export class TigerController {
  private state: TigerState = 'idle';
  private stateStarted = 0;
  private lastInteraction = 0;
  private targetX = 0;
  private targetY = 0;

  constructor(private readonly rig: Rig) {}

  setPointer(x: number, y: number, now: number) {
    this.targetX = x;
    this.targetY = y;
    this.lastInteraction = now;
    if (this.state === 'sleep') this.enter('wake', now);
    else if (this.state === 'idle') this.enter('look', now);
  }

  react(now: number) {
    this.lastInteraction = now;
    this.enter('react', now);
  }

  update(now: number, delta: number) {
    const elapsed = (now - this.stateStarted) / 1000;
    const idleFor = (now - this.lastInteraction) / 1000;
    if (idleFor > 24 && this.state !== 'sleep') this.enter('sleep', now);
    if (this.state === 'look' && elapsed > 3.2) this.enter('idle', now);
    if (this.state === 'react' && elapsed > 1.1) this.enter('idle', now);
    if (this.state === 'wake' && elapsed > 0.8) this.enter('idle', now);

    const breath = Math.sin(now * 0.0022) * 0.025;
    this.rig.body.scale.y = 1 + breath;
    this.rig.tail.rotation.z = -0.65 + Math.sin(now * 0.003) * 0.28;

    const desiredHeadX = this.state === 'sleep' ? 0.28 : this.targetY * 0.22;
    const desiredHeadY = this.state === 'sleep' ? 0 : this.targetX * 0.34;
    this.rig.head.rotation.x += (desiredHeadX - this.rig.head.rotation.x) * Math.min(1, delta * 5);
    this.rig.head.rotation.y += (desiredHeadY - this.rig.head.rotation.y) * Math.min(1, delta * 5);

    const blinkPhase = now % 4300;
    const blink = blinkPhase > 4020 ? Math.max(0.08, Math.abs(blinkPhase - 4160) / 140) : 1;
    const sleepScale = this.state === 'sleep' ? 0.08 : blink;
    this.rig.eyes.forEach((eye) => {
      eye.scale.y = (eye.userData.baseScaleY ?? 1) * sleepScale;
    });

    if (this.state === 'react') {
      const jump = Math.sin(Math.min(1, elapsed / 0.75) * Math.PI) * 0.5;
      this.rig.root.position.y = this.rig.root.userData.baseY + jump;
      this.rig.frontLeft.rotation.z = -0.3 - jump * 0.7;
      this.rig.frontRight.rotation.z = 0.3 + jump * 0.7;
      this.rig.root.rotation.z = Math.sin(elapsed * 14) * 0.045;
    } else {
      this.rig.root.position.y += (this.rig.root.userData.baseY - this.rig.root.position.y) * Math.min(1, delta * 6);
      this.rig.frontLeft.rotation.z += (-0.08 - this.rig.frontLeft.rotation.z) * Math.min(1, delta * 5);
      this.rig.frontRight.rotation.z += (0.08 - this.rig.frontRight.rotation.z) * Math.min(1, delta * 5);
      this.rig.root.rotation.z *= Math.max(0, 1 - delta * 7);
    }

    if (this.state === 'sleep') {
      this.rig.root.rotation.z += (-0.09 - this.rig.root.rotation.z) * Math.min(1, delta * 2);
      this.rig.head.position.y = 0.68 + Math.sin(now * 0.0018) * 0.018;
    } else {
      this.rig.head.position.y += (0.9 - this.rig.head.position.y) * Math.min(1, delta * 4);
    }
  }

  private enter(state: TigerState, now: number) {
    this.state = state;
    this.stateStarted = now;
  }
}
