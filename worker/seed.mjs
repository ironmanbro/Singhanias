// Prints SQL for the starting catalogue (for manual use with `wrangler d1 execute`). The Worker also does this automatically on first start.
import { SCHEMA, seedStatements } from './src/bootstrap.js';
const stock = !process.argv.includes('--no-stock');
if (process.argv.includes('--schema')) console.log(SCHEMA.join(';\n') + ';');
else console.log(seedStatements(undefined, { stock }).join(';\n') + ';');
