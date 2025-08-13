// backend/routes/bitrixContacts.ts
import { Router, Request, Response } from 'express';

// === Minimal Bitrix client using built-in fetch (Node >= 18) ===
const BASE = process.env.BITRIX_WEBHOOK || '';
if (!BASE) {
  // eslint-disable-next-line no-console
  console.warn('[BX/contacts] BITRIX_WEBHOOK is not set');
}

async function bx(method: string, params: Record<string, any> = {}) {
  const url = `${BASE}${method}.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && (data.error || data.error_description))) {
    const msg = (data && (data.error_description || data.error)) || `HTTP ${res.status}`;
    throw new Error(`Bitrix API error: ${method}: ${msg}`);
  }
  return data.result;
}

const log = (...args: any[]) => console.log('[BX/contacts]', ...args);

const r = Router();

// Helpers
const isEmail = (s = ''): boolean => /\S+@\S+\.\S+/.test(s);
const isPhone = (s = ''): boolean => /^[+\d\s().-]{5,}$/.test(s);
const normDate = (v: unknown): string => {
  const s = typeof v === 'string' ? v : '';
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already YYYY-MM-DD
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); // DD.MM.YYYY
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
};

// GET /api/bitrix/contacts
r.get('/', async (req: Request, res: Response) => {
  try {
    // Safely coerce query params
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const ownerRaw = typeof req.query.owner === 'string' ? req.query.owner.trim() : '';
    const createdFrom = normDate(req.query.createdFrom);
    const createdTo = normDate(req.query.createdTo);
    const hasEmail = String(req.query.hasEmail) === 'true';
    const hasPhone = String(req.query.hasPhone) === 'true';
    const lmt = Math.min(Math.max(parseInt(String(req.query.limit ?? '24'), 10) || 24, 1), 50);
    const st = parseInt(String(req.query.start ?? '0'), 10) || 0;

    log('incoming query', req.query);
    log('computed limits', { limit: lmt, start: st });

    // Build filter
    const filter: any = {};
    if (ownerRaw && /^\d+$/.test(ownerRaw)) filter.ASSIGNED_BY_ID = Number(ownerRaw);
    if (createdFrom) filter['>=DATE_CREATE'] = `${createdFrom} 00:00:00`;
    if (createdTo) filter['<=DATE_CREATE'] = `${createdTo} 23:59:59`;

    let searchFilter: any = {};
    if (q) {
      if (isEmail(q)) {
        searchFilter = { '=%EMAIL': q };
      } else if (isPhone(q)) {
        searchFilter = { '=%PHONE': q.replace(/\D/g, '') };
      } else {
        searchFilter = {
          LOGIC: 'OR',
          '%NAME': q,
          '%LAST_NAME': q,
          '%SECOND_NAME': q,
        };
      }
    }

    const finalFilter: any = Object.keys(searchFilter).length ? { ...filter, ...searchFilter } : filter;
    log('effective filter', finalFilter);

    const params: Record<string, any> = {
      filter: finalFilter,
      select: [
        'ID',
        'NAME',
        'LAST_NAME',
        'SECOND_NAME',
        'PHONE',
        'EMAIL',
        'ASSIGNED_BY_ID',
        'DATE_CREATE',
      ],
      order: { DATE_CREATE: 'DESC' },
    };
    if (st > 0) params.start = st; // do not send start if 0

    log('calling crm.contact.list with', params);
    const result = await bx('crm.contact.list', params);

    log('bitrix result type', Array.isArray(result) ? 'array' : typeof result, 'keys', result && Object.keys(result));

    const items: any[] = Array.isArray(result) ? result : (result?.items ?? []);
    const next = typeof (result as any)?.next === 'number' ? (result as any).next : items.length === lmt ? st + lmt : null;
    log('items fetched', { count: Array.isArray(items) ? items.length : 0, next });

    // Post-filtering for presence flags
    let filtered = items;
    if (hasEmail) {
      filtered = filtered.filter((it: any) => (it.EMAIL?.[0]?.VALUE || '').trim() !== '');
    }
    if (hasPhone) {
      filtered = filtered.filter((it: any) => (it.PHONE?.[0]?.VALUE || '').trim() !== '');
    }

    res.json({ ok: true, items: filtered, next });
  } catch (e: any) {
    console.error('[BX/contacts] error', e?.stack || e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
});

export default r;