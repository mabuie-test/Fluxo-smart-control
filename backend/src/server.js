const app = require('./app');
const { connectDb } = require('./config/db');
const { ensureDevice } = require('./services/deviceSyncService');
const { port } = require('./config/env');
async function start() { await connectDb(); await ensureDevice(); app.listen(port, () => console.log(`Servidor online na porta ${port}`)); }
start().catch((err) => { console.error(err); process.exit(1); });
