import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { authMiddleware, JwtPayload } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validation/schemas.js';

const router = Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  if (username !== config.adminUser || password !== config.adminPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ username } as JwtPayload, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ username: req.user!.username });
});

export default router;
