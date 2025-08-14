import { Router } from 'express';

const router = Router();
const RAW_BASE = process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX_WEBHOOK || '';
const BASE = RAW_BASE ? (RAW_BASE.endsWith('/') ? RAW_BASE : RAW_BASE + '/') : '';

router.get('/user.current', async (_req, res) => {
    try {
        if (!BASE) {
            return res.status(200).json({ mock: true, result: { ID: 1, NAME: 'Demo', LAST_NAME: 'User' } });
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
        // disable cache to avoid 304 on the frontend while debugging
        res.set('Cache-Control', 'no-store');

        let limit = parseInt(req.query.limit as string);
        let start = parseInt(req.query.start as string);
        if (isNaN(limit) || limit < 1) limit = 24; // used only to trim the Bitrix result if needed
        if (limit > 50) limit = 50;
        if (isNaN(start) || start < 0) start = 0;

        if (!BASE) {
            // Return Bitrix-like shape
            return res.status(200).json({
                result: [
                    {
                        ID: '1',
                        NAME: 'Demo',
                        LAST_NAME: 'Client',
                        SECOND_NAME: null,
                        PHONE: [],
                        EMAIL: [],
                        ASSIGNED_BY_ID: null,
                        DATE_CREATE: new Date().toISOString(),
                        TYPE_ID: 'CLIENT',
                        SOURCE_ID: 'OTHER'
                    }
                ],
                next: null
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

        if (!data || !Array.isArray(data.result)) {
            return res.status(502).json({ error: 'Invalid response from Bitrix', raw: data });
        }

        // optionally trim to limit to mimic page size, but keep Bitrix shape
        if (data.result.length > limit) {
            data.result = data.result.slice(0, limit);
        }

        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: 'Bitrix proxy failed', details: e?.response?.data || e?.message });
    }
});

router.get('/contact/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (!BASE) {
      return res.status(200).json({
        result: {
          ID: '1',
          NAME: 'Demo',
          LAST_NAME: 'User',
          SECOND_NAME: null,
          ASSIGNED_BY_ID: '10',
          DATE_CREATE: new Date().toISOString(),
          TYPE_ID: 'CLIENT',
          SOURCE_ID: 'OTHER',
          PHONE: [{ ID: '1', VALUE_TYPE: 'WORK', VALUE: '+1-202-555-0123', TYPE_ID: 'PHONE' }],
          EMAIL: [{ ID: '1', VALUE_TYPE: 'WORK', VALUE: 'demo@example.com', TYPE_ID: 'EMAIL' }],
          COMPANY_ID: null
        }
      });
    }

    const params = new URLSearchParams();
    params.append('id', id);
    const r = await fetch(`${BASE}crm.contact.get.json?${params.toString()}`);
    const data = await r.json();
    if (!data || !data.result) return res.status(502).json({ error: 'Invalid Bitrix response', raw: data });
    return res.json(data);
  } catch (e: any) {
    return res.status(502).json({ error: 'Bitrix proxy failed', details: e?.response?.data || e?.message });
  }
});

router.get('/company/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (!BASE) {
      return res.status(200).json({
        result: {
          ID: '10',
          TITLE: 'Demo Company',
          ADDRESS: 'Some street, 1',
          INDUSTRY: 'IT',
          PHONE: [{ ID: '1', VALUE_TYPE: 'WORK', VALUE: '+1-202-555-0456', TYPE_ID: 'PHONE' }],
          EMAIL: [{ ID: '1', VALUE_TYPE: 'WORK', VALUE: 'info@demo.co', TYPE_ID: 'EMAIL' }]
        }
      });
    }

    const params = new URLSearchParams();
    params.append('id', id);
    const r = await fetch(`${BASE}crm.company.get.json?${params.toString()}`);
    const data = await r.json();
    if (!data || !data.result) return res.status(502).json({ error: 'Invalid Bitrix response', raw: data });
    return res.json(data);
  } catch (e: any) {
    return res.status(502).json({ error: 'Bitrix proxy failed', details: e?.response?.data || e?.message });
  }
});

export default router;