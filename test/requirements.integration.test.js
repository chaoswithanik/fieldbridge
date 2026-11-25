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
  const { individualRequirementMatches } = await import('../src/services/matching.js');
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

  let matchRequirement, matchRows, matchTemplate;
  test('individual matching uses the saved exact crop, unit and sufficient stock across districts', async () => {
    const created = await request('', { method: 'POST', body: input });
    assert.equal(created.status, 201);
    matchRequirement = created.data.requirement;
    matchTemplate = {
      farmerId: actors.farmer.id,
      cropName: input.cropName,
      cropId: matchRequirement.cropId,
      varietyId: matchRequirement.varietyId,
      quantity: '1000.125',
      unit: 'kg',
      pricePerUnit: '40',
      harvestDate: '2026-11-23',
      availableDate: '2026-11-25',
      district: 'বগুড়া',
      upazila: 'শিবগঞ্জ',
      farmAddress: 'এই ফসলের খামারের ঠিকানা',
      description: 'পরীক্ষার ফসলের বিবরণ।',
      photoFilenames: ['c382327b-5682-4ab4-baf6-2d70ec977eb5.webp'],
    };
    const unverified = await models.User.create({
      role: 'farmer',
      fullName: 'যাচাইবিহীন কৃষক',
      phone: '01900000087',
      passwordHash: (await models.User.unscoped().findByPk(actors.farmer.id)).passwordHash,
    });
    await models.FarmerProfile.create({
      userId: unverified.id,
      nid: '1234567887',
      district: 'বগুড়া',
      upazila: 'শিবগঞ্জ',
      village: 'পরীক্ষা',
      farmAddress: 'পরীক্ষার ঠিকানা',
    });
    matchRows = await models.CropListing.bulkCreate([
      { ...matchTemplate },
      {
        ...matchTemplate,
        quantity: '1500',
        pricePerUnit: '30',
        harvestDate: '2026-11-22',
        availableDate: '2026-11-26',
        district: 'রংপুর',
        upazila: 'মিঠাপুকুর',
      },
      { ...matchTemplate, quantity: '1000.124' },
      { ...matchTemplate, unit: 'ton', quantity: '2000' },
      { ...matchTemplate, cropId: null, varietyId: null, cropName: 'আমন ধান %_' },
      { ...matchTemplate, cropId: null, varietyId: null, cropName: 'আমন ধান চাল' },
      { ...matchTemplate, quantity: '2000', status: 'inactive' },
      { ...matchTemplate, quantity: '2000', status: 'sold_out' },
      { ...matchTemplate, quantity: '0' },
      { ...matchTemplate, farmerId: unverified.id, quantity: '2000' },
    ]);
    const before = await models.PurchaseRequirement.findByPk(matchRequirement.id);
    const result = await request(`/${matchRequirement.id}/matches`);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.total, 2);
    assert.equal(result.data.sort, 'available_asc');
    assert.deepEqual(
      result.data.listings.map((row) => row.id),
      [matchRows[0].id, matchRows[1].id],
    );
    assert.equal(result.data.requirement.quantity, '1000.125');
    for (const listing of result.data.listings) {
      assert.equal(listing.farmer.fullName, actors.farmer.fullName);
      assert.equal(listing.farmer.phone, actors.farmer.phone);
      assert.equal(listing.farmer.farmAddress, matchTemplate.farmAddress);
      assert(!JSON.stringify(listing).includes('1234567883'));
      for (const key of ['farmerId', 'passwordHash', 'nid', 'email'])
        assert.equal(key in listing, false);
    }
    await before.reload();
    assert.equal(before.editCount, 0);
    assert.equal(before.version, 1);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  });

  test('matching is private to the approved requirement owner and never accepts filter overrides', async () => {
    const url = `/${matchRequirement.id}/matches`;
    assert.equal((await request(url, { cookie: '' })).status, 401);
    for (const role of ['pending', 'farmer', 'admin'])
      assert.equal((await request(url, { cookie: cookies[role] })).status, 403);
    assert.equal((await request(url, { cookie: cookies.other })).status, 404);
    assert.equal((await request('/not-a-real-id/matches')).status, 404);
    for (const query of [
      'quantity=0',
      'unit=ton',
      'cropName=ধান',
      'buyerId=someone',
      'page=-1',
      'sort=constructor',
      'sort=price_asc&sort=price_desc',
    ])
      assert.equal((await request(`${url}?${query}`)).status, 422, query);
    await models.BuyerProfile.update({ status: 'pending' }, { where: { userId: actors.buyer.id } });
    assert.equal((await request(url)).status, 403);
    await assert.rejects(
      individualRequirementMatches(actors.buyer.id, matchRequirement.id),
      (error) => error.status === 403,
    );
    await models.BuyerProfile.update(
      { status: 'approved' },
      { where: { userId: actors.buyer.id } },
    );
  });

  test('matching sorts one criterion at a time and stock/status changes take effect on refresh', async () => {
    const url = `/${matchRequirement.id}/matches`;
    for (const [sort, expected] of [
      ['price_asc', matchRows[1].id],
      ['price_desc', matchRows[0].id],
      ['harvest_asc', matchRows[1].id],
      ['available_asc', matchRows[0].id],
    ]) {
      const result = await request(`${url}?sort=${sort}`);
      assert.equal(result.status, 200);
      assert.equal(result.data.listings[0].id, expected);
    }
    await matchRows[1].update({ quantity: '1000.124' });
    assert.equal((await request(url)).data.total, 1);
    await matchRows[0].update({ status: 'inactive' });
    assert.equal((await request(url)).data.total, 0);
    await matchRows[1].update({ quantity: '1500' });
    await matchRows[0].update({ status: 'active' });
  });

  test('matches follow the latest requirement, remain read-only after both edits, and support paused requirements', async () => {
    const url = `/${matchRequirement.id}`;
    for (const quantity of ['2000', '1000.125']) {
      const edited = await request(url, {
        method: 'PUT',
        body: { ...input, quantity, version: matchRequirement.version },
      });
      assert.equal(edited.status, 200);
      matchRequirement = edited.data.requirement;
      const matches = await request(`${url}/matches`);
      assert.equal(matches.data.total, quantity === '2000' ? 0 : 2);
      assert.equal(matches.data.requirement.version, matchRequirement.version);
    }
    assert.equal(matchRequirement.editCount, 2);
    const changed = await request(`${url}/status`, {
      method: 'PATCH',
      body: { status: 'inactive', version: matchRequirement.version },
    });
    matchRequirement = changed.data.requirement;
    const matches = await request(`${url}/matches`);
    assert.equal(matches.data.requirement.status, 'inactive');
    assert.equal(matches.data.total, 2);
    assert.equal(matches.data.requirement.editCount, 2);
    assert.equal(matches.data.requirement.editsRemaining, 0);
    assert.equal(
      (await models.PurchaseRequirement.findByPk(matchRequirement.id)).version,
      matchRequirement.version,
    );
  });

  test('matching pagination is stable, returns a useful empty page and rejects a deleted requirement', async () => {
    await models.CropListing.bulkCreate(Array.from({ length: 11 }, () => ({ ...matchTemplate })));
    const url = `/${matchRequirement.id}/matches`;
    const first = (await request(`${url}?page=1`)).data,
      second = (await request(`${url}?page=2`)).data;
    assert.equal(first.total, 13);
    assert.equal(first.listings.length, 12);
    assert.equal(second.listings.length, 1);
    assert.equal(second.pages, 2);
    assert.equal(new Set([...first.listings, ...second.listings].map((row) => row.id)).size, 13);
    assert.deepEqual((await request(`${url}?page=3`)).data.listings, []);
    assert.equal((await request(`${url}?page=3`)).data.requirement.id, matchRequirement.id);
    await models.PurchaseRequirement.destroy({ where: { id: matchRequirement.id } });
    assert.equal((await request(url)).status, 404);
  });

  test('market discovery, matching and checkout agree on crop aliases and optional variety', async () => {
    const { previewOrder } = await import('../src/services/orders.js');
    const { searchMarketListings } = await import('../src/services/marketplace.js');
    const { cropSelection } = await import('../shared/crop-catalog.js');
    const identities = [cropSelection('potato'), cropSelection('potato', 'red'), cropSelection('sweet-potato')];
    const lots = await models.CropListing.bulkCreate(identities.map((identity) => ({
      ...matchTemplate, ...identity, quantity: '100',
    })));
    for (const [q, expected] of [['ALU', [0, 1]], ['red pot', [1]], ['মিষ্টিআলু', [2]]]) {
      const market = await searchMarketListings(null, { q });
      assert.deepEqual(new Set(market.listings.map((row) => row.id)), new Set(expected.map((i) => lots[i].id)));
    }
    for (const [cropName, expected] of [['potatoes', [0, 1]], ['লাল আলু', [1]]]) {
      const { data, status } = await request('', { method: 'POST', body: { ...input, cropName, quantity: '100' } });
      assert.equal(status, 201);
      const requirementId = data.requirement.id;
      const matches = await request(`/${requirementId}/combinations`);
      assert.deepEqual(new Set(matches.data.combinations.flatMap((c) => c.listings.map((l) => l.id))),
        new Set(expected.map((i) => lots[i].id)));
      for (const [index, listing] of lots.entries()) {
        const preview = previewOrder(actors.buyer.id, { requirementId, listingIds: [listing.id] });
        if (expected.includes(index)) assert((await preview).quoteToken);
        else await assert.rejects(preview, (error) => error.status === 409);
      }
    }
  });

  test('catalog migration converts exact aliases and leaves ambiguous legacy names available for review', async () => {
    const { up } = await import('../migrations/20261125-010-crop-catalog.js');
    const listings = await models.CropListing.bulkCreate(['RED potato', 'আলু বা মিষ্টি আলু'].map((cropName) => ({
      ...matchTemplate, cropId: null, varietyId: null, cropName,
    })));
    const demand = await models.PurchaseRequirement.create({
      buyerId: actors.buyer.id, cropName: '  Alu ', quantity: '5', unit: 'kg', deliveryAddress: input.deliveryAddress,
    });
    await up({ context: sequelize.getQueryInterface() });
    for (const row of [...listings, demand]) await row.reload();
    assert.equal(listings[0].cropId, 'potato');
    assert.equal(listings[0].varietyId, 'red');
    assert.equal(listings[1].cropId, null);
    assert.equal(listings[1].cropName, 'আলু বা মিষ্টি আলু');
    assert.equal(demand.cropId, 'potato');
    assert.equal(demand.varietyId, null);
  });
}
