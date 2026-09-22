/* One command, one table. Exits non-zero if any check failed -- or if any check
   could not be shown to catch the failure it watches. */
import {report} from './lib.mjs';
const t0=Date.now();
await import('./checks-sheet.mjs');
if(!process.argv.includes('--no-browser')){ await import('./checks-render.mjs'); await import('./checks-world.mjs'); await import('./checks-style.mjs'); await import('./checks-audio.mjs'); }
const ok=report();
console.log(`  ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
process.exit(ok?0:1);
