import type { GameRuntime, RuntimeHost } from './contracts';
/** The tuned simulation/audio core stays JavaScript during the engine migration.
 * Phaser interacts with it exclusively through this typed ownership boundary. */
export function createCosmoRuntime(host: RuntimeHost): GameRuntime;
