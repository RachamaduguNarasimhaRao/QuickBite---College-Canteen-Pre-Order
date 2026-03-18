import assert from 'node:assert';
import app from '@/worker';

// Minimal fake DB implementation to satisfy the worker handlers used in these tests.
function makeFakeDb() {
  return {
    calls: [] as string[],
    prepare(sql: string) {
      this.calls.push(sql);
      return {
        bind: (...args: any[]) => {
          return {
            run: async () => {
              // For INSERT INTO orders -> return last_row_id
              if (/INSERT INTO orders/.test(sql)) {
                return { meta: { last_row_id: 1 } };
              }
              // generic success
              return { success: true };
            },
            first: async () => {
              // SELECT role FROM user_roles WHERE user_id = ?
              if (/SELECT role FROM user_roles/.test(sql)) {
                // If the bound user id contains 'dev-staff' return staff role
                const uid = args[0];
                if (uid === 'dev-staff' || uid === 'staff123' || uid === 'dev-staff') {
                  return { role: 'staff' };
                }
                if (uid === 'dev-admin') return { role: 'admin' };
                return { role: 'student' };
              }

              // SELECT * FROM food_items ...
              if (/SELECT \* FROM food_items WHERE id = \? AND is_available = 1/.test(sql)) {
                return { id: 1, name: 'Test Item', price: 100, is_available: 1 };
              }

              // SELECT * FROM orders WHERE id = ? -> return mocked order
              if (/SELECT \* FROM orders WHERE id = \?/.test(sql)) {
                // return the new schema including user_name so handlers return it
                return { id: 1, user_id: 'dev-staff', user_email: 'staff@example.com', user_name: 'dev-staff', status: 'pending', total_price: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
              }

              return null;
            },
            all: async () => {
              if (/SELECT \* FROM orders ORDER BY/.test(sql)) return { results: [] };
              if (/SELECT \* FROM food_items WHERE is_available = 1/.test(sql)) return { results: [] };
              return { results: [] };
            }
          };
        }
      };
    }
  };
}

function getSetCookie(res: Response) {
  const raw = res.headers.get('set-cookie') || res.headers.get('Set-Cookie');
  return raw || null;
}

describe('Staff dev-session and ordering behavior', () => {
  it('POST /api/sessions with dev-staff should set cookie and seed staff role', async () => {
    const fakeEnv = { DB: makeFakeDb() } as any;

    const res = await app.fetch(new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'dev-staff' }),
    }), { env: fakeEnv } as any);

    assert.strictEqual(res.status, 200);
    const cookie = getSetCookie(res);
    assert.ok(cookie, 'Expected set-cookie header to be present');
    // Ensure DB was called to insert role
    const calledSql = fakeEnv.DB.calls.join('\n');
    assert.ok(/INSERT OR REPLACE INTO user_roles/.test(calledSql), 'Expected user_roles insert');
  });

  it('GET /__dev/login/staff should set cookie and seed staff role', async () => {
    const fakeEnv = { DB: makeFakeDb() } as any;

    const res = await app.fetch(new Request('http://localhost/__dev/login/staff', { method: 'GET' }), { env: fakeEnv } as any);
    assert.strictEqual(res.status, 200);
    const cookie = getSetCookie(res);
    assert.ok(cookie, 'Expected set-cookie header to be present');
    const calledSql = fakeEnv.DB.calls.join('\n');
    assert.ok(/INSERT OR REPLACE INTO user_roles/.test(calledSql), 'Expected user_roles insert');
  });

  it('POST /api/orders should allow staff to place order regardless of ordering window', async () => {
    const fakeEnv = { DB: makeFakeDb() } as any;

    // Create a request with the dev-session cookie for dev-staff
    const body = JSON.stringify({ items: [{ food_item_id: 1, quantity: 1 }] });
    const res = await app.fetch(new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cookie': 'mocha-session-token=dev-session:dev-staff:staff@example.com' },
      body,
    }), { env: fakeEnv } as any);

    // Staff should be allowed and a 201 is expected for newly created order
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.id, 1);
    // the backend now attaches a customer name field; for dev sessions we
    // seed it with the user id
    assert.strictEqual(data.user_name, 'dev-staff');
  });
});
