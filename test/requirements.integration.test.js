import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

if (process.env.AUTH_INTEGRATION !== '1') {
  test(
    'MySQL purchase requirement integration tests (npm run test:integration)',
    { skip: true },
    () => {},
  );
} else {
  if (!/^fb_test_[a-f0-9]{12}_$/.test(process.env.AUTH_TEST_TABLE_PREFIX || ''))
    throw new Error('Isolated test tables required.');
  const { app } = await import('../src/app.js');
  const { sequelize } = await import('../src/config/database.js');
  const { models } = await import('../src/models/index.js');
  const { env } = await import('../src/config/env.js');
  const { migrationRunner } = await import('../src/config/migrations.js');
  const { hashPassword } = await import('../src/lib/crypto.js');
  const { newSession } = await import('../src/services/auth.js');
  const { createRequirement } = await import('../src/services/requirements.js');
  const actors = {},
    cookies = {};
  const input = {
    cropName: 'আমন ধান',
    quantity: '১০০০.১২৫',
    unit: 'kg',
    deliveryAddress: 'পরীক্ষার গুদাম, মিরপুর, ঢাকা',
    instructions: '',
  };
  let server, base, current;
  before(async () => {
    await migrationRunner(sequelize).up();
    assert.equal((await migrationRunner(sequelize).up()).length, 0);
    const passwordHash = await hashPassword('RequirementTest123');
    for (const [index, name] of ['buyer', 'other', 'pending', 'farmer', 'admin'].entries()) {
      const role = ['farmer', 'admin'].includes(name) ? name : 'buyer';
      const user = await models.User.create({
        role,
        fullName: `পরীক্ষার ${name}`,
        phone: `0190000008${index}`,
        passwordHash,
        phoneVerifiedAt: role === 'farmer' ? new Date() : null,
      });
      actors[name] = user;
      if (role === 'buyer')
        await models.BuyerProfile.create({
          userId: user.id,
          businessName: 'পরীক্ষার ব্যবসা',
          businessType: 'পাইকারি',
          address: 'পরীক্ষার ব্যবসার ঠিকানা',
          submittedAt: new Date(),
          status: name === 'pending' ? 'pending' : 'approved',
        });
      if (role === 'farmer')
        await models.FarmerProfile.create({
          userId: user.id,
          nid: '1234567883',
          district: 'বগুড়া',
          upazila: 'শিবগঞ্জ',
          village: 'মহাস্থান',
          farmAddress: 'পরীক্ষার খামারের ঠিকানা',
        });
      cookies[name] = `fieldbridge_session=${(await newSession(user.id)).token}`;
    }
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', (error) =>
        error ? reject(error) : resolve(instance),
      );
    });
    base = `http://127.0.0.1:${server.address().port}/api/buyer/requirements`;
  });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  });
  async function request(
    path = '',
    { method = 'GET', body, cookie = cookies.buyer, origin = env.clientOrigin } = {},
  ) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  test('only approved buyers can access requirements; origins, anonymous callers and other roles are rejected', async () => {
    assert.equal((await request('', { cookie: '' })).status, 401);
    for (const name of ['farmer', 'admin', 'pending']) {
      assert.equal((await request('', { cookie: cookies[name] })).status, 403);
      assert.equal(
        (await request('', { method: 'POST', body: input, cookie: cookies[name] })).status,
        403,
      );
    }
    await models.BuyerProfile.update(
      { status: 'rejected' },
      { where: { userId: actors.pending.id } },
    );
    assert.equal((await request('', { cookie: cookies.pending })).status, 403);
    assert.equal(
      (await request('', { method: 'POST', body: input, origin: 'https://other.example' })).status,
      403,
    );
  });
  test('creation requires crop, quantity, unit and delivery address and never accepts client-owned counters or excluded fields', async () => {
    const invalid = await request('', { method: 'POST', body: {} });
    assert.equal(invalid.status, 422);
    for (const key of ['cropName', 'quantity', 'unit', 'deliveryAddress'])
      assert(invalid.data.fields[key]);
    for (const key of [
      'buyerId',
      'status',
      'editCount',
      'editsRemaining',
      'maxBudget',
      'expectedPrice',
      'deliveryDate',
    ])
      assert.equal(
        (await request('', { method: 'POST', body: { ...input, [key]: 2 } })).status,
        422,
      );
    const result = await request('', { method: 'POST', body: input });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    current = result.data.requirement;
    assert.equal(current.quantity, '1000.125');
    assert.equal(current.editCount, 0);
    assert.equal(current.editsRemaining, 2);
    assert.equal(current.version, 1);
    assert.equal(current.status, 'active');
    assert.equal(current.instructions, null);
    assert.equal('buyerId' in current, false);
    assert.equal((await models.PurchaseRequirement.findByPk(current.id)).buyerId, actors.buyer.id);
  });
  test('a buyer can only read or mutate their own requirements', async () => {
    const own = await request();
    assert.equal(own.data.total, 1);
    assert.equal(own.headers.get('cache-control'), 'no-store');
    assert.equal((await request('', { cookie: cookies.other })).data.total, 0);
    for (const options of [
      {},
      { method: 'PUT', body: { ...input, version: 1 } },
      { method: 'DELETE', body: { version: 1 } },
    ])
      assert.equal(
        (await request(`/${current.id}`, { ...options, cookie: cookies.other })).status,
        404,
      );
    assert.equal(
      (
        await request(`/${current.id}/status`, {
          method: 'PATCH',
          cookie: cookies.other,
          body: { status: 'fulfilled', version: 1 },
        })
      ).status,
      404,
    );
    assert.equal((await request('/not-a-valid-id')).status, 404);
    assert.equal((await request('?status=unknown')).status, 422);
  });
  test('unchanged submissions do not spend edits; changed content uses one edit and old versions are rejected', async () => {
    let result = await request(`/${current.id}`, {
      method: 'PUT',
      body: { ...input, quantity: '1000.125', version: current.version },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.requirement.editCount, 0);
    assert.equal(result.data.requirement.version, 1);
    result = await request(`/${current.id}`, {
      method: 'PUT',
      body: { ...input, quantity: '৯০০', version: current.version },
    });
    assert.equal(result.status, 200);
    current = result.data.requirement;
    assert.equal(current.editCount, 1);
    assert.equal(current.editsRemaining, 1);
    assert.equal(current.version, 2);
    assert.equal(
      (await request(`/${current.id}`, { method: 'PUT', body: { ...input, version: 1 } })).status,
      409,
    );
    assert.equal((await models.PurchaseRequirement.findByPk(current.id)).editCount, 1);
  });
  test('concurrent edits cannot bypass the two-edit cap and client fields cannot reset it', async () => {
    const results = await Promise.all(
      ['800', '700'].map((quantity) =>
        request(`/${current.id}`, {
          method: 'PUT',
          body: { ...input, quantity, version: current.version },
        }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    current = results.find((result) => result.status === 200).data.requirement;
    assert.equal(current.editCount, 2);
    assert.equal(current.editsRemaining, 0);
    assert.equal(
      (
        await request(`/${current.id}`, {
          method: 'PUT',
          body: { ...input, version: current.version },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/${current.id}`, {
          method: 'PUT',
          body: { ...input, version: current.version, editCount: 0 },
        })
      ).status,
      422,
    );
    assert.equal((await models.PurchaseRequirement.findByPk(current.id)).editCount, 2);
  });
  test('status changes remain available after two edits and never spend or reset edits', async () => {
    for (const status of ['inactive', 'active', 'fulfilled', 'active']) {
      const oldVersion = current.version;
      const result = await request(`/${current.id}/status`, {
        method: 'PATCH',
        body: { status, version: current.version },
      });
      assert.equal(result.status, 200);
      current = result.data.requirement;
      assert.equal(current.status, status);
      assert.equal(current.editCount, 2);
      assert.equal(current.editsRemaining, 0);
      assert.equal(current.version, oldVersion + 1);
    }
    const same = await request(`/${current.id}/status`, {
      method: 'PATCH',
      body: { status: current.status, version: current.version },
    });
    assert.equal(same.data.requirement.version, current.version);
    assert.equal(
      (
        await request(`/${current.id}/status`, {
          method: 'PATCH',
          body: { status: 'inactive', version: 1 },
        })
      ).status,
      409,
    );
  });
  test('approval revocation takes effect on the existing session and is enforced inside write transactions', async () => {
    await models.BuyerProfile.update({ status: 'pending' }, { where: { userId: actors.buyer.id } });
    assert.equal((await request()).status, 403);
    assert.equal((await request('', { method: 'POST', body: input })).status, 403);
    await assert.rejects(
      createRequirement(actors.buyer.id, input),
      (error) => error.status === 403,
    );
    await models.BuyerProfile.update(
      { status: 'approved' },
      { where: { userId: actors.buyer.id } },
    );
    assert.equal((await request()).status, 200);
  });
  test('pagination and status counts contain only the signed-in buyer data', async () => {
    await models.PurchaseRequirement.bulkCreate(
      Array.from({ length: 12 }, () => ({
        buyerId: actors.buyer.id,
        ...input,
        quantity: '1000.125',
      })),
    );
    const first = (await request('?page=1')).data,
      second = (await request('?page=2')).data;
    assert.equal(first.total, 13);
    assert.equal(first.requirements.length, 12);
    assert.equal(second.requirements.length, 1);
    assert.equal(second.pages, 2);
    assert.equal(first.counts.active, 13);
    assert.equal(
      new Set([...first.requirements, ...second.requirements].map((row) => row.id)).size,
      13,
    );
    assert.equal((await request('', { cookie: cookies.other })).data.total, 0);
    assert.equal((await request('?status=fulfilled')).data.total, 0);
  });
  test('deletion requires the current version and works even after both edits are used', async () => {
    assert.equal(
      (await request(`/${current.id}`, { method: 'DELETE', body: { version: 1 } })).status,
      409,
    );
    assert.equal(
      (await request(`/${current.id}`, { method: 'DELETE', body: { version: current.version } }))
        .status,
      200,
    );
    assert.equal((await request(`/${current.id}`)).status, 404);
  });
}
