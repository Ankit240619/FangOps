import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { UserRole, loggers } from '@fangops/core';
import { v4 as uuidv4 } from 'uuid';

const log = loggers.api;

export default async function authRoutes(app: FastifyInstance) {
    app.post('/api/v1/auth/login', async (request, reply) => {
        const { email, password } = request.body as any;

        if (!email || !password) {
            return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Email and password required' } });
        }

        const userRecord = await db.select().from(users).where(eq(users.email, email)).get();

        if (!userRecord || !(await bcrypt.compare(password, userRecord.passwordHash))) {
            return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
        }

        const token = app.jwt.sign({
            id: userRecord.id,
            email: userRecord.email,
            role: userRecord.role as UserRole
        });

        return {
            success: true,
            data: {
                token,
                user: {
                    id: userRecord.id,
                    email: userRecord.email,
                    name: userRecord.name,
                    role: userRecord.role,
                }
            }
        };
    });

    app.get('/api/v1/auth/me', { preValidation: [app.authenticate] }, async (request, reply) => {
        const userRecord = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
        }).from(users).where(eq(users.id, request.user.id)).get();

        if (!userRecord) {
            return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        return {
            success: true,
            data: userRecord,
        };
    });

    app.post('/api/v1/auth/register', { preValidation: [app.requireRole([UserRole.ADMIN])] }, async (request, reply) => {
        const { email, password, name, role } = request.body as any;

        if (!email || !password || !name) {
            return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing required fields' } });
        }

        const existing = await db.select().from(users).where(eq(users.email, email)).get();
        if (existing) {
            return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'User already exists' } });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            email,
            name,
            passwordHash,
            role: role || UserRole.VIEWER,
            createdAt: new Date(),
        };

        await db.insert(users).values(newUser);
        log.info({ user: email }, 'New user registered');

        return {
            success: true,
            data: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
            }
        };
    });
}
