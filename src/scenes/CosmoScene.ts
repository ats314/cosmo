import Phaser from 'phaser';
import { createCosmoRuntime } from '../game/runtime.js';
import type { GamePointer, GameRuntime } from '../game/contracts';
import { haptic, installNativeBridge, isNative } from '../platform/native';
import { createFlightWorld, type FlightFrame, type FlightWorld } from '../game/flight-world';

/** Render directly into Phaser's Canvas renderer. No iframe, second animation
 * loop, or per-frame upload of a full CanvasTexture is involved. The separate
 * GPU background and bloom remain resources of this scene's runtime. */
class OrbitDisplay extends Phaser.GameObjects.GameObject {
  constructor(scene: Phaser.Scene, private readonly runtime: GameRuntime) {
    super(scene, 'OrbitDisplay');
  }
  renderCanvas(_renderer: Phaser.Renderer.Canvas.CanvasRenderer, _src: OrbitDisplay, camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.addToRenderList(this);
    this.runtime.render();
  }
}

export class CosmoScene extends Phaser.Scene {
  private runtime?: GameRuntime;
  private disposeNative?: () => void;
  private disposed = false;
  private engineUpdates = 0;
  private flight?: FlightWorld;
  private background?: HTMLCanvasElement;
  private flightFailed = false;
  private voyageReady = false;
  private resetFlight = (): void => {
    this.flight?.dispose();
    this.flight = undefined;
    this.flightFailed = false;
    this.voyageReady = false;
  };
  private resizeWindow = (): void => { this.resizeToWindow(); };

  constructor() { super('Cosmo'); }

  create(): void {
    this.disposed = false;
    const canvas = this.game.canvas;
    const background = document.querySelector<HTMLCanvasElement>('#bg');
    const context = canvas.getContext('2d');
    if (!background || !context) throw new Error('Cosmo needs its game canvas and sky canvas.');
    this.background = background;
    background.addEventListener('webglcontextlost', this.resetFlight);
    background.addEventListener('webglcontextrestored', this.resetFlight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.runtime = createCosmoRuntime({
      canvas, context, background,
      width: window.innerWidth, height: window.innerHeight, dpr,
      externalLoop: true, externalLifecycle: true, native: isNative, haptic,
      flightEnabled: new URLSearchParams(window.location.search).get('flight') !== '0',
      hasVoyageScene: () => this.voyageReady && !this.flightFailed && !this.disposed,
      renderFlight: (frame) => this.renderFlight(frame),
      getTexture: (key) => {
        if (!this.textures.exists(key)) return null;
        const source = this.textures.get(key).getSourceImage();
        return source instanceof HTMLImageElement || source instanceof HTMLCanvasElement ? source : null;
      },
    });
    this.add.existing(new OrbitDisplay(this, this.runtime));
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.input.addPointer(1);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.pointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.pointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.pointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.pointerUp, this);
    this.input.keyboard?.on('keydown', this.keyDown, this);
    window.addEventListener('resize', this.resizeWindow);
    window.visualViewport?.addEventListener('resize', this.resizeWindow);
    this.game.events.on(Phaser.Core.Events.BLUR, this.blur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.resizeToWindow();
    const runtime = this.runtime;
    window.COSMO_APP = { engine: 'Phaser', version: Phaser.VERSION, snapshot: () => ({
      ...runtime.snapshot(), loopOwner: 'Phaser', engineUpdates: this.engineUpdates,
      sceneCount: this.game.scene.getScenes(true).length,
      background: { ...runtime.snapshot().background, flight: !!this.flight && !this.flightFailed,
        voyage: this.voyageReady },
    }) };
    void installNativeBridge({
      pause: () => runtime.pause(),
      // Returning to the app leaves the existing pause screen visible.
      resume: () => this.resizeToWindow(),
      back: () => runtime.back(),
    }).then(dispose => { if (this.disposed) dispose(); else this.disposeNative = dispose; });
  }

  update(_time: number, delta: number): void { this.engineUpdates++; this.runtime?.step(delta); }

  private renderFlight(frame: FlightFrame): void {
    this.voyageReady = false;
    if (!frame.enabled || this.disposed || this.flightFailed) return;
    try {
      // Reuse the runtime's already-created context, never acquire another sky.
      if (!this.flight) {
        const gl = this.background?.getContext('webgl');
        if (!gl || gl.isContextLost()) return;
        this.flight = createFlightWorld(gl);
      }
      this.voyageReady = this.flight.render(frame) && !!frame.voyage && !frame.transition?.completed;
    } catch (error) {
      // A decorative pass cannot interrupt the original playable game.
      this.flight?.dispose();
      this.flight = undefined;
      this.flightFailed = true;
      console.warn('Cosmo flight presentation unavailable; original sky remains.', error);
    }
  }

  private pointerEvent(pointer: Phaser.Input.Pointer, type: GamePointer['type']): GamePointer {
    const event = pointer.event as MouseEvent | TouchEvent | PointerEvent;
    const originalId = 'pointerId' in event ? event.pointerId : pointer.id;
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      pointerId: originalId, type,
      clientX: rect.left + pointer.x * rect.width / this.scale.width,
      clientY: rect.top + pointer.y * rect.height / this.scale.height,
      preventDefault: () => { if (event.cancelable) event.preventDefault(); },
    };
  }
  private pointerDown(pointer: Phaser.Input.Pointer): void { this.runtime?.pointerDown(this.pointerEvent(pointer, 'pointerdown')); }
  private pointerMove(pointer: Phaser.Input.Pointer): void { this.runtime?.pointerMove(this.pointerEvent(pointer, 'pointermove')); }
  private pointerUp(pointer: Phaser.Input.Pointer): void {
    const cancelled = pointer.event.type === 'touchcancel' || pointer.event.type === 'pointercancel';
    const event = this.pointerEvent(pointer, cancelled ? 'pointercancel' : 'pointerup');
    if (cancelled) this.runtime?.pointerCancel(event); else this.runtime?.pointerUp(event);
  }
  private keyDown(event: KeyboardEvent): void { this.runtime?.keyDown(event); }
  private blur(): void { this.runtime?.pause(); }

  private resizeToWindow(): void {
    if (this.disposed || !this.runtime) return;
    const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Phaser owns backing-store dimensions; gameplay keeps CSS-pixel geometry.
    this.scale.resize(Math.round(width * dpr), Math.round(height * dpr));
    this.game.canvas.style.width = `${width}px`;
    this.game.canvas.style.height = `${height}px`;
    this.scale.updateBounds();
    this.scale.displayScale.set(this.scale.baseSize.width / width, this.scale.baseSize.height / height);
    this.runtime.resize(width, height, dpr);
  }
  private shutdown(): void {
    this.disposed = true;
    this.disposeNative?.();
    window.removeEventListener('resize', this.resizeWindow);
    window.visualViewport?.removeEventListener('resize', this.resizeWindow);
    this.game.events.off(Phaser.Core.Events.BLUR, this.blur, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.pointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.pointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.pointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.pointerUp, this);
    this.input.keyboard?.off('keydown', this.keyDown, this);
    this.background?.removeEventListener('webglcontextlost', this.resetFlight);
    this.background?.removeEventListener('webglcontextrestored', this.resetFlight);
    this.resetFlight();
    this.background = undefined;
    this.runtime?.destroy();
    this.runtime = undefined;
    delete window.COSMO_APP;
  }
}
