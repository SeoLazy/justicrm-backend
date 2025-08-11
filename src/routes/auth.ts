import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { signAccess, signRefresh, verify } from '../lib/jwt';

const prisma = new PrismaClient();
const router = Router();

router.post('/login', async (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(4) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { sub: user.id, email: user.email };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // включим true после HTTPS
        maxAge: 7 * 24 * 3600 * 1000,
        path: '/api/auth',
    });

    return res.json({ accessToken });
});

router.post('/refresh', async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    try {
        const payload: any = verify(token);
        if (payload?.type !== 'refresh') return res.status(401).json({ error: 'Bad token type' });
        const accessToken = signAccess({ sub: payload.sub, email: payload.email });
        return res.json({ accessToken });
    } catch (e) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

router.post('/logout', async (_req, res) => {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ ok: true });
});

export default router;