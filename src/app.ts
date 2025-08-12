import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth';
import bitrixRoutes from './routes/bitrix';
// @ts-ignore
import bitrixContactsRoutes from './routes/bitrixContacts';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/bitrix', bitrixRoutes);
app.use('/api/bitrix/contacts', bitrixContactsRoutes);

export default app;