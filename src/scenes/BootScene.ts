import Phaser from 'phaser';

interface ArtManifest { textures?: Record<string, string> }

/** The asset cache is owned by Phaser. Gemini's approved individual PNG/WebP
 * files can be added to public/art/manifest.json without another asset loader. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void { this.load.json('cosmo-art', 'art/manifest.json'); }
  create(): void {
    const manifest = this.cache.json.get('cosmo-art') as ArtManifest | undefined;
    let queued = 0;
    for (const [key, file] of Object.entries(manifest?.textures ?? {})) {
      if (!/^[-\w]+$/.test(key) || !/^[-\w./]+\.(png|webp|jpg)$/.test(file) || file.includes('..')) continue;
      this.load.image(key, `art/${file}`); queued++;
    }
    if (queued) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('Cosmo'));
      this.load.start();
    } else this.scene.start('Cosmo');
  }
}
