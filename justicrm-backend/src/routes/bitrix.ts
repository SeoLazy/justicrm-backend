import { Router } from 'express';

const router = Router();
const BASE = process.env.BITRIX_WEBHOOK_URL;

router.get('/user.current', async (_req, res) => {
    try {
        if (!BASE) {
            return res.status(501).json({ mock: true, result: { ID: 1, NAME: 'Demo', LAST_NAME: 'User' } });
        }
        const r = await fetch(`${BASE}user.current.json`);
        const data = await r.json();
        res.json(data);
    } catch (e: any) {
        res.status(502).json({ error: 'Bitrix proxy failed', details: e?.message });
    }
});

export default router;