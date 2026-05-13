import 'dotenv/config';
import express from 'express';
import { default as handler, config } from './api/extract.js';

const app = express();

// Item 10: CORS for dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.json({ limit: config.api.bodyParser.sizeLimit }));
app.post('/api/extract', (req, res) => handler(req, res));
app.listen(3001, () => console.log('API server running on http://localhost:3001'));
