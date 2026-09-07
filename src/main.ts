import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CosmoScene } from './scenes/CosmoScene';
import './styles.css';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
if (!canvas) throw new Error('Missing Cosmo canvas.');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  canvas,
  parent: document.body,
  width: Math.round(window.innerWidth * dpr),
  height: Math.round(window.innerHeight * dpr),
  transparent: true,
  antialias: true,
  disableContextMenu: true,
  banner: false,
  audio: { noAudio: true }, // The game's keyed WebAudio instrument owns sound.
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  input: { activePointers: 2, smoothFactor: 0 },
  fps: { target: 60, smoothStep: false },
  scene: [BootScene, CosmoScene],
});

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(false));
