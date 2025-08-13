import { Router } from 'express';

const router = Router();
const BASE = process.env.BITRIX_WEBHOOKK;

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

router.get('/clients', async (req, res) => {
    try {
        let limit = parseInt(req.query.limit as string);
        let start = parseInt(req.query.start as string);
        if (isNaN(limit) || limit < 1) limit = 24;
        if (limit > 50) limit = 50;
        if (isNaN(start) || start < 0) start = 0;

        if (!BASE) {
            return res.status(200).json({
                mock: true,
                items: [
                    {
                        ID: 1,
                        NAME: 'Demo',
                        LAST_NAME: 'Client',
                        SECOND_NAME: '',
                        PHONE: [],
                        EMAIL: [],
                        ASSIGNED_BY_ID: null,
                        DATE_CREATE: '',
                        TYPE_ID: '',
                        SOURCE_ID: ''
                    }
                ],
                next: null,
                total: 1
            });
        }

        const params = new URLSearchParams();
        params.append('start', start.toString());
        params.append('select[]', 'ID');
        params.append('select[]', 'NAME');
        params.append('select[]', 'LAST_NAME');
        params.append('select[]', 'SECOND_NAME');
        params.append('select[]', 'PHONE');
        params.append('select[]', 'EMAIL');
        params.append('select[]', 'ASSIGNED_BY_ID');
        params.append('select[]', 'DATE_CREATE');
        params.append('select[]', 'TYPE_ID');
        params.append('select[]', 'SOURCE_ID');
        params.append('select[]', 'UF_*');

        const r = await fetch(`${BASE}crm.contact.list.json?${params.toString()}`);
        const data = await r.json();

        if (!data.result || !Array.isArray(data.result)) {
            return res.status(502).json({ error: 'Invalid response from Bitrix' });
        }

        const items = Array.isArray(data.result) ? data.result.slice(0, limit) : [];
        return res.json({ items, next: data.next ?? null, total: items.length });
    } catch (e: any) {
        res.status(502).json({ error: 'Bitrix proxy failed', details: e?.message });
    }
});

export default router;