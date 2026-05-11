import 'dotenv/config';
import express from 'express';
import { default as handler, config } from './api/extract.js';

const app = express();
app.use(express.json({ limit: config.api.bodyParser.sizeLimit }));

app.post('/api/extract', (req, res) => handler(req, res));

app.listen(3001, () => console.log('API server running on http://localhost:3001'));
