import express from 'express';
import dotenv from 'dotenv';
import { handleRpc } from './proxy/rpc-handler.js';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
app.post('/mcp/v1', handleRpc);

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Universal MCP Hub listening on :${port}`); });
