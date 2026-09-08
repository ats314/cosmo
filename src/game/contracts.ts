import type { HapticKind } from '../platform/native';
import type { FlightFrame } from './flight-world';

export interface HitRect { id: string; x: number; y: number; w: number; h: number }
export interface GameSnapshot {
  state: string;
  introStage: number | null;
  ringIndex: number;
  direction: number;
  score: number;
  level: number;
  journey: { chapter: number; destination: string; phase: string; progress: number; open: boolean } | null;
  paused: boolean;
  viewport: { width: number; height: number; dpr: number };
  menuRects: HitRect[];
  introSkipRect?: Omit<HitRect, 'id'> | null;
  frames: number;
  steps: number;
  loopOwner?: 'Phaser';
  sceneCount?: number;
  engineUpdates?: number;
  background: { gpu: boolean; materialCount: number; classicDraws: number; flight?: boolean; voyage?: boolean };
  reward: { orbits: number; starfall: boolean; wave: number };
}
export interface GamePointer {
  pointerId: number;
  clientX: number;
  clientY: number;
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';
  preventDefault(): void;
}
export interface RuntimeHost {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  background: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
  externalLoop: true;
  externalLifecycle: true;
  native?: boolean;
  haptic?: (kind: HapticKind) => void;
  getTexture?: (key: string) => HTMLImageElement | HTMLCanvasElement | null;
  flightEnabled?: boolean;
  /** True only after the host has successfully drawn the destination surface. */
  hasVoyageScene?: () => boolean;
  renderFlight?: (frame: FlightFrame) => void;
}
export interface GameRuntime {
  step(deltaMs: number): void;
  render(): void;
  resize(width: number, height: number, dpr: number): void;
  pointerDown(event: GamePointer): void;
  pointerMove(event: GamePointer): void;
  pointerUp(event: GamePointer): void;
  pointerCancel(event: GamePointer): void;
  keyDown(event: KeyboardEvent): void;
  pause(): void;
  resume(): void;
  back(): boolean;
  snapshot(): GameSnapshot;
  flightFrame(): FlightFrame;
  destroy(): void;
}

declare global {
  interface Window {
    COSMO_APP?: { engine: 'Phaser'; version: string; snapshot(): GameSnapshot };
  }
  const __COSMO_BUILD__: string;
}
