import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { UserRole } from '@fangops/core';

// Extend fastify namespace for typescript
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRole: (roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: { id: string; email: string; role: UserRole };
        user: { id: string; email: string; role: UserRole };
    }
}

export default fp(async (fastify: FastifyInstance) => {
    // Register JWT Plugin
    fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || 'super-secret-fallback-key-change-in-prod',
    });

    // Decorate fastify with authenticate method
    fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.status(401).send({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
        }
    });

    // Decorate fastify with RBAC method
    fastify.decorate('requireRole', function (roles: UserRole[]) {
        return async function (request: FastifyRequest, reply: FastifyReply) {
            try {
                await request.jwtVerify();
                if (!roles.includes(request.user.role)) {
                    reply.status(403).send({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
                    });
                }
            } catch (err) {
                reply.status(401).send({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
                });
            }
        };
    });
});
