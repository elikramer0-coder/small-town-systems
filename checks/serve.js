// Local preview: `npm start` then open http://localhost:8787
// (Static pages only. The contact form needs the Pages Function; see README for `wrangler pages dev`.)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './static-server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = Number(process.env.PORT) || 8787;
createStaticServer(root).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
