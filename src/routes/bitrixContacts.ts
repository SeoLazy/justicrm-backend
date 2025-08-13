// backend/routes/bitrixContacts.ts
import { Router } from 'express';
import { bitrix } from '../bitrixClient.js';

const log = (...args) => console.log('[BX/contacts]', ...args);

const r = Router();

// Утилиты
const isEmail = (s='') => /\S+@\S+\.\S+/.test(s);
const isPhone = (s='') => /^[+\d\s().-]{5,}$/.test(s);

// GET /api/bitrix/contacts?q=&owner=&createdFrom=&createdTo=&hasEmail=&hasPhone=&limit=&start=
r.get('/', async (req, res) => {
    try {
        const {
            q = '',
            owner = '',
            createdFrom = '',
            createdTo = '',
            hasEmail = '',
            hasPhone = '',
            limit = '24',
            start = '0',
        } = req.query;

        const lmt = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 50);
        const st = parseInt(start, 10) || 0;

        log('incoming query', req.query);
        log('computed limits', { limit: lmt, start: st });

        // Базовый фильтр
        const filter = {};
        // Ответственный
        if (owner) filter.ASSIGNED_BY_ID = owner;
        // Даты создания
        if (createdFrom) filter[">=DATE_CREATE"] = `${createdFrom} 00:00:00`;
        if (createdTo) filter["<=DATE_CREATE"] = `${createdTo} 23:59:59`;

        // Поиск
        let searchFilter = {};
        if (q) {
            if (isEmail(q)) {
                searchFilter = { "=%EMAIL": q }; // точнее по email
            } else if (isPhone(q)) {
                searchFilter = { "=%PHONE": q.replace(/\D/g, '') }; // по цифрам телефона
            } else {
                // Частичное совпадение по имени/фамилии
                // Попробуем объединить через LOGIC OR
                searchFilter = {
                    "LOGIC": "OR",
                    "%NAME": q,
                    "%LAST_NAME": q,
                    "%SECOND_NAME": q,
                };
            }
        }

        // Собираем финальный фильтр
        const finalFilter = Object.keys(searchFilter).length
            ? { ...filter, ...searchFilter }
            : filter;

        log('effective filter', finalFilter);

        const params = {
            filter: finalFilter,
            select: [
                'ID','NAME','LAST_NAME','SECOND_NAME',
                'PHONE','EMAIL','ASSIGNED_BY_ID',
                'DATE_CREATE','PHOTO'
            ],
            order: { 'DATE_CREATE': 'DESC' },
            start: st,
        };
        log('calling crm.contact.list with', params);
        const result = await bitrix('crm.contact.list', params);

        log('bitrix result type', Array.isArray(result) ? 'array' : typeof result, 'keys', result && Object.keys(result));

        // Bitrix возвращает массив; next может прийти в result.next или во внешнем поле
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        const next = (typeof result?.next === 'number')
            ? result.next
            : (items.length === lmt ? st + lmt : null);

        log('items fetched', { count: Array.isArray(items) ? items.length : 0, next });

        // Дополнительные фильтры по наличию email/phone — на бэке (надёжно)
        let filtered = items;
        if (String(hasEmail) === 'true') {
            filtered = filtered.filter(it => (it.EMAIL?.[0]?.VALUE || '').trim() !== '');
        }
        if (String(hasPhone) === 'true') {
            filtered = filtered.filter(it => (it.PHONE?.[0]?.VALUE || '').trim() !== '');
        }

        res.json({ ok: true, items: filtered, next });
    } catch (e) {
        console.error('[BX/contacts] error', e && (e.stack || e.message || e));
        res.status(500).json({ ok: false, error: e.message });
    }
});

export default r;