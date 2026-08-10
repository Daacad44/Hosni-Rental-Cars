import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Role } from '@hosni/shared';
import { app, authCookie, principal, makeTenant, type TestUser } from './helpers.js';

/**
 * Role gates are enforced in middleware — hiding a button in React is not
 * security. This asserts the WHOLE route table, not a sample: every id-addressed
 * endpoint the API exposes, with the exact roles its router/route allows,
 * transcribed from src/routes/*.routes.ts. For each endpoint we check that a
 * disallowed role is refused with 403 (before any body validation runs, so the
 * bodies here are deliberately minimal) and that an allowed role is let through.
 *
 * §2 role model:
 *   - AGENT is the booking desk: reservations, agreements, invoices, customers,
 *     quotes. No fleet writes, no money reports, no user or rate-card admin.
 *   - MECHANIC is the workshop: vehicles and maintenance only. No money at all.
 */

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
interface Endpoint {
  method: Method;
  path: string;
  allow: Role[];
  body?: Record<string, unknown>;
}

const ALL: Role[] = ['OWNER', 'MANAGER', 'AGENT', 'MECHANIC'];
const ID = 'nonexistent-id';

// The full table. `allow` is the set of roles the route admits; every role not
// listed must receive 403.
const ROUTES: Endpoint[] = [
  // users — OWNER/MANAGER
  { method: 'get', path: '/users', allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: '/users', allow: ['OWNER', 'MANAGER'] },
  { method: 'patch', path: `/users/${ID}`, allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: `/users/${ID}/deactivate`, allow: ['OWNER', 'MANAGER'] },

  // vehicles — reads open to all, writes OWNER/MANAGER/MECHANIC
  { method: 'get', path: '/vehicles', allow: ALL },
  { method: 'get', path: `/vehicles/${ID}`, allow: ALL },
  { method: 'get', path: `/vehicles/${ID}/documents`, allow: ALL },
  { method: 'get', path: `/vehicles/${ID}/photos`, allow: ALL },
  { method: 'post', path: '/vehicles', allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'patch', path: `/vehicles/${ID}`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'post', path: `/vehicles/${ID}/odometer`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'post', path: `/vehicles/${ID}/out-of-service`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'delete', path: `/vehicles/${ID}`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'post', path: `/vehicles/${ID}/documents`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'delete', path: `/vehicles/${ID}/documents/${ID}`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'delete', path: `/vehicles/${ID}/photos/${ID}`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },

  // customers — OWNER/MANAGER/AGENT; merge OWNER/MANAGER
  { method: 'get', path: '/customers', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: `/customers/${ID}`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: '/customers', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'patch', path: `/customers/${ID}`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/customers/${ID}/block`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/customers/${ID}/unblock`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/customers/${ID}/merge`, allow: ['OWNER', 'MANAGER'] },

  // rate cards — read OWNER/MANAGER, write OWNER
  { method: 'get', path: '/rate-cards', allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: '/rate-cards', allow: ['OWNER'] },
  { method: 'put', path: `/rate-cards/${ID}`, allow: ['OWNER'] },
  { method: 'delete', path: `/rate-cards/${ID}`, allow: ['OWNER'] },

  // quotes — OWNER/MANAGER/AGENT
  { method: 'post', path: '/quotes', allow: ['OWNER', 'MANAGER', 'AGENT'] },

  // reservations — OWNER/MANAGER/AGENT
  { method: 'get', path: '/reservations/available-vehicles', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: '/reservations', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: `/reservations/${ID}`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: '/reservations', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/reservations/${ID}/confirm`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/reservations/${ID}/cancel`, allow: ['OWNER', 'MANAGER', 'AGENT'] },

  // agreements — OWNER/MANAGER/AGENT
  { method: 'get', path: '/agreements', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: `/agreements/${ID}`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: '/agreements/checkout', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/agreements/${ID}/settlement-preview`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/agreements/${ID}/checkin`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/agreements/${ID}/extend`, allow: ['OWNER', 'MANAGER', 'AGENT'] },

  // invoices — OWNER/MANAGER/AGENT; void OWNER/MANAGER
  { method: 'get', path: '/invoices/cash-summary', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: '/invoices', allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'get', path: `/invoices/${ID}`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/invoices/${ID}/payments`, allow: ['OWNER', 'MANAGER', 'AGENT'] },
  { method: 'post', path: `/invoices/${ID}/void`, allow: ['OWNER', 'MANAGER'] },

  // maintenance — OWNER/MANAGER/MECHANIC (AGENT excluded)
  { method: 'get', path: '/maintenance', allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'get', path: `/maintenance/${ID}`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'post', path: '/maintenance', allow: ['OWNER', 'MANAGER', 'MECHANIC'] },
  { method: 'patch', path: `/maintenance/${ID}/status`, allow: ['OWNER', 'MANAGER', 'MECHANIC'] },

  // expenses — OWNER/MANAGER
  { method: 'get', path: '/expenses', allow: ['OWNER', 'MANAGER'] },
  { method: 'get', path: '/expenses/export', allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: '/expenses', allow: ['OWNER', 'MANAGER'] },
  { method: 'delete', path: `/expenses/${ID}`, allow: ['OWNER', 'MANAGER'] },

  // fines — OWNER/MANAGER
  { method: 'get', path: '/fines', allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: '/fines', allow: ['OWNER', 'MANAGER'] },
  { method: 'post', path: `/fines/${ID}/charge`, allow: ['OWNER', 'MANAGER'] },

  // reports — OWNER/MANAGER
  { method: 'get', path: '/reports/revenue', allow: ['OWNER', 'MANAGER'] },
  { method: 'get', path: '/reports/profitability', allow: ['OWNER', 'MANAGER'] },
  { method: 'get', path: '/reports/outstanding', allow: ['OWNER', 'MANAGER'] },
  { method: 'get', path: '/reports/overdue', allow: ['OWNER', 'MANAGER'] },

  // dashboard & alerts — any signed-in user
  { method: 'get', path: '/dashboard', allow: ALL },
  { method: 'get', path: '/alerts', allow: ALL },
];

function send(method: Method, path: string, cookie: string, body: unknown) {
  const req = request(app)[method](`/api/v1${path}`).set('Cookie', cookie);
  return method === 'get' || method === 'delete' ? req : req.send(body ?? {});
}

describe('role enforcement — the full route table', () => {
  const users: Record<Role, TestUser> = {} as Record<Role, TestUser>;

  beforeEach(async () => {
    const { organizationId, branchId } = await makeTenant('R');
    for (const role of ALL) {
      users[role] = principal({ organizationId, role, branchId });
    }
  });

  it('every route refuses each disallowed role with 403', async () => {
    const violations: string[] = [];
    for (const ep of ROUTES) {
      for (const role of ALL) {
        if (ep.allow.includes(role)) continue;
        const res = await send(ep.method, ep.path, authCookie(users[role]), ep.body);
        if (res.status !== 403 || res.body?.error?.code !== 'FORBIDDEN') {
          violations.push(
            `${role} ${ep.method.toUpperCase()} ${ep.path} → ${res.status} ${res.body?.error?.code ?? ''} (expected 403 FORBIDDEN)`,
          );
        }
      }
    }
    expect(violations, `role gate failures:\n${violations.join('\n')}`).toEqual([]);
  });

  it('AGENT is refused from every manager-only endpoint', async () => {
    const managerOnly = ROUTES.filter((ep) => !ep.allow.includes('AGENT'));
    // Guard the guard: there really are such endpoints across every money/admin area.
    expect(managerOnly.length).toBeGreaterThan(15);
    for (const ep of managerOnly) {
      const res = await send(ep.method, ep.path, authCookie(users.AGENT), ep.body);
      expect(res.status, `AGENT ${ep.method} ${ep.path}`).toBe(403);
      expect(res.body?.error?.code).toBe('FORBIDDEN');
    }
  });

  it('MECHANIC is refused from every money endpoint', async () => {
    const moneyForbidden = ROUTES.filter((ep) => !ep.allow.includes('MECHANIC'));
    expect(moneyForbidden.length).toBeGreaterThan(15);
    for (const ep of moneyForbidden) {
      const res = await send(ep.method, ep.path, authCookie(users.MECHANIC), ep.body);
      expect(res.status, `MECHANIC ${ep.method} ${ep.path}`).toBe(403);
      expect(res.body?.error?.code).toBe('FORBIDDEN');
    }
  });

  it('an allowed role is never blocked by the role gate', async () => {
    // The positive control: allowed roles must pass the gate (they may then hit
    // 404/400/200, but never 403/401). This catches an over-tight gate.
    const overBlocked: string[] = [];
    for (const ep of ROUTES) {
      for (const role of ep.allow) {
        const res = await send(ep.method, ep.path, authCookie(users[role]), ep.body);
        if (res.status === 403 || res.status === 401) {
          overBlocked.push(`${role} ${ep.method.toUpperCase()} ${ep.path} → ${res.status}`);
        }
      }
    }
    expect(overBlocked, `over-blocked:\n${overBlocked.join('\n')}`).toEqual([]);
  });
});
