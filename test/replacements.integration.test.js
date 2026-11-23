import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.AUTH_INTEGRATION !== '1')
  test('MySQL replacement integration tests (npm run test:integration)', { skip: true }, () => {});
else {
  if (!/^fb_test_[a-f0-9]{12}_$/.test(process.env.AUTH_TEST_TABLE_PREFIX || ''))
    throw new Error('Isolated tables required');
  const { app } = await import('../src/app.js'),
    { sequelize } = await import('../src/config/database.js'),
    { models } = await import('../src/models/index.js');
  const { migrationRunner } = await import('../src/config/migrations.js'),
    { env } = await import('../src/config/env.js'),
    { hashPassword } = await import('../src/lib/crypto.js'),
    { newSession } = await import('../src/services/auth.js');
  const { previewOrder, placeOrder, respondToOrder } = await import('../src/services/orders.js');
  const actors = {},
    cookies = {};
  let server,
    base,
    index = 0;
  const fixture = {
    cropName: 'বিকল্প ধান',
    quantity: '1000.000',
    unit: 'kg',
    pricePerUnit: '20.00',
    harvestDate: '2026-11-23',
    availableDate: '2026-11-25',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    farmAddress: 'বিকল্প ফসলের খামারের ঠিকানা',
    description: 'পরীক্ষার ফসলের বিবরণ',
    photoFilenames: ['c382327b-5682-4ab4-baf6-2d70ec977eb5.webp'],
  };
  before(async () => {
    await migrationRunner(sequelize).up();
    const passwordHash = await hashPassword('ReplacementTest123');
    for (const [i, name] of [
      'buyer',
      'other',
      'pending',
      'admin',
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
      'f6',
    ].entries()) {
      const role = name.startsWith('f') ? 'farmer' : name === 'admin' ? 'admin' : 'buyer';
      actors[name] = await models.User.create({
        role,
        fullName: `পরীক্ষার ${name}`,
        phone: `0190000005${i}`,
        passwordHash,
        phoneVerifiedAt: role === 'farmer' ? new Date() : null,
      });
      if (role === 'buyer')
        await models.BuyerProfile.create({
          userId: actors[name].id,
          businessName: 'পরীক্ষার ব্যবসা',
          businessType: 'পাইকারি',
          address: 'পরীক্ষার ডেলিভারি গুদাম',
          status: name === 'pending' ? 'pending' : 'approved',
          submittedAt: new Date(),
        });
      if (role === 'farmer')
        await models.FarmerProfile.create({
          userId: actors[name].id,
          nid: `123456770${i}`,
          district: 'বগুড়া',
          upazila: 'শিবগঞ্জ',
          village: 'মহাস্থান',
          farmAddress: 'প্রোফাইলের ঠিকানা',
          farmName: 'সবুজ কৃষি খামার',
        });
      cookies[name] = `fieldbridge_session=${(await newSession(actors[name].id)).token}`;
    }
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', (error) =>
        error ? reject(error) : resolve(instance),
      );
    });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  });
  async function request(
    path,
    { method = 'GET', body, actor = 'buyer', origin = env.clientOrigin } = {},
  ) {
    const response = await fetch(`${base}/${path}`, {
      method,
      headers: {
        Origin: origin,
        ...(actor ? { Cookie: cookies[actor] } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function setup({
    requested = '1000.000',
    quantities = ['600.000', '400.000'],
    reject = true,
  } = {}) {
    const cropName = `বিকল্প ধান ${++index}`,
      requirement = await models.PurchaseRequirement.create({
        buyerId: actors.buyer.id,
        cropName,
        quantity: requested,
        unit: 'kg',
        deliveryAddress: 'অর্ডারের পুরোনো ডেলিভারি গুদাম',
        instructions: 'শুকনো বস্তায় দিন।',
      });
    const original = await models.CropListing.bulkCreate(
      quantities.map((quantity, i) => ({
        ...fixture,
        cropName,
        quantity,
        farmerId: actors[`f${i + 1}`].id,
      })),
    );
    const quote = await previewOrder(actors.buyer.id, {
        requirementId: requirement.id,
        listingIds: original.map((row) => row.id),
      }),
      placed = await placeOrder(actors.buyer.id, {
        quoteToken: quote.quoteToken,
        requestId: randomUUID(),
      });
    if (reject) {
      if (original.length > 1)
        await respondToOrder(
          actors.f1.id,
          placed.order.portions.find((p) => p.farmer.phone === actors.f1.phone).id,
          { decision: 'accepted', version: 1 },
        );
      const declined = original.length > 1 ? 'f2' : 'f1';
      await respondToOrder(
        actors[declined].id,
        placed.order.portions.find((p) => p.farmer.phone === actors[declined].phone).id,
        { decision: 'rejected', version: 1 },
      );
    }
    const order = (await request(`orders/${placed.order.id}`)).data.order;
    return { cropName, requirement, original, order };
  }
  async function candidates(set, quantities = ['1000.000', '200.000', '200.000', '80.000']) {
    return models.CropListing.bulkCreate(
      quantities.map((quantity, i) => ({
        ...fixture,
        cropName: set.cropName,
        quantity,
        farmerId: actors[`f${i + 3}`].id,
        pricePerUnit: `${20 + i}.00`,
        ...(i === 1 ? { district: 'রংপুর', upazila: 'পীরগাছা' } : {}),
      })),
    );
  }
  const path = (set) => `orders/${set.order.id}/replacements`;
  async function quote(set, rows) {
    const result = await request(`${path(set)}/quote`, {
      method: 'POST',
      body: { listingIds: rows.map((r) => r.id) },
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  }
  async function confirm(set, rows) {
    const preview = await quote(set, rows),
      result = await request(path(set), {
        method: 'POST',
        body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
      });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.order;
  }
  test('recommendations are automatic, capped at five, exclude every assigned farmer and never reserve stock', async () => {
    const set = await setup(),
      rows = await candidates(set);
    await models.CropListing.bulkCreate([
      { ...fixture, cropName: set.cropName, farmerId: actors.f1.id },
      { ...fixture, cropName: set.cropName, farmerId: actors.f2.id },
      { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, status: 'inactive' },
      { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, status: 'sold_out' },
      { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, quantity: '0.000' },
      { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, unit: 'ton' },
      { ...fixture, cropName: `${set.cropName} চাল`, farmerId: actors.f3.id },
    ]);
    const before = await models.Notification.count(),
      result = await request(path(set));
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.remainingQuantity, '400.000');
    assert(result.data.recommendations.length <= 5);
    assert.equal(result.data.recommendations[0].fulfilment, 'exact');
    assert(
      result.data.recommendations.some(
        (match) => match.farmerCount === 2 && match.quantity === '400.000',
      ),
    );
    for (const match of result.data.recommendations)
      for (const listing of match.listings) {
        assert(rows.some((row) => row.id === listing.id));
        assert.equal('farmerId' in listing, false);
        assert.equal('nid' in listing.farmer, false);
      }
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(await models.Notification.count(), before);
    for (const row of rows) assert.equal((await row.reload()).reservedQuantity, '0.000');
  });
  test('replacement reads and writes require an approved owning buyer; farmer/admin/cross-buyer access and field overrides fail', async () => {
    const set = await setup(),
      rows = await candidates(set);
    assert.equal((await request(path(set), { actor: '' })).status, 401);
    for (const actor of ['f1', 'admin', 'pending'])
      assert.equal((await request(path(set), { actor })).status, 403);
    assert.equal((await request(path(set), { actor: 'other' })).status, 404);
    for (const query of [
      'quantity=1',
      'unit=ton',
      'sort=constructor',
      'sort=price_asc&sort=available_asc',
    ])
      assert.equal((await request(`${path(set)}?${query}`)).status, 422);
    assert.equal(
      (
        await request(`${path(set)}/quote`, {
          method: 'POST',
          body: { listingIds: [rows[0].id], quantity: 1 },
        })
      ).status,
      422,
    );
    const preview = await quote(set, [rows[0]]);
    assert.equal(
      (
        await request(path(set), {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          actor: 'other',
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(path(set), {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          origin: 'https://other.example',
        })
      ).status,
      403,
    );
    await models.BuyerProfile.update(
      { status: 'rejected' },
      { where: { userId: actors.buyer.id } },
    );
    assert.equal(
      (
        await request(path(set), {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
        })
      ).status,
      403,
    );
    await models.BuyerProfile.update(
      { status: 'approved' },
      { where: { userId: actors.buyer.id } },
    );
  });
  test('manual listing filters and pagination stay scoped to this immutable order and retain permitted farmer fields', async () => {
    const set = await setup(),
      rows = await candidates(set);
    await models.CropListing.bulkCreate(
      Array.from({ length: 10 }, () => ({
        ...fixture,
        cropName: set.cropName,
        quantity: '50.000',
        farmerId: actors.f6.id,
      })),
    );
    const first = (await request(`${path(set)}/listings`)).data,
      second = (await request(`${path(set)}/listings?page=2`)).data;
    assert.equal(first.total, 14);
    assert.equal(first.listings.length, 12);
    assert.equal(second.listings.length, 2);
    assert.equal(new Set([...first.listings, ...second.listings].map((r) => r.id)).size, 14);
    const filtered = (
      await request(`${path(set)}/listings?district=রংপুর&upazila=পীরগাছা&sort=price_asc`)
    ).data;
    assert.deepEqual(
      filtered.listings.map((r) => r.id),
      [rows[1].id],
    );
    assert.equal(filtered.listings[0].farmer.farmAddress, fixture.farmAddress);
    assert.equal((await request(`${path(set)}/listings?farmerId=someone`)).status, 422);
    assert.equal((await request(`${path(set)}/listings?district=%25`)).data.total, 0);
  });
  test('single replacement takes only the missing amount, creates a new farmer portion and leaves original snapshots unchanged', async () => {
    const set = await setup(),
      rows = await candidates(set),
      preview = await quote(set, [rows[0]]);
    assert.equal(preview.preview.totalQuantity, '400.000');
    assert.equal(preview.preview.afterQuantity, '1000.000');
    assert.equal((await rows[0].reload()).reservedQuantity, '0.000');
    await set.requirement.update({
      cropName: 'অন্য ফসল',
      quantity: '999.000',
      deliveryAddress: 'অন্য ঠিকানা',
      version: 2,
    });
    await set.requirement.destroy();
    const result = await request(path(set), {
      method: 'POST',
      body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const order = result.data.order;
    assert.equal(order.totalQuantity, set.order.totalQuantity);
    assert.equal(order.totalCost, set.order.totalCost);
    assert.equal(order.deliveryAddress, 'অর্ডারের পুরোনো ডেলিভারি গুদাম');
    assert.equal(order.cropName, set.cropName);
    assert.equal(order.currentQuantity, '1000.000');
    assert.equal(order.replacementNeededQuantity, '0.000');
    assert.equal(order.rejectedQuantity, '400.000');
    assert.equal(order.portions.filter((p) => p.isReplacement).length, 1);
    assert.equal((await rows[0].reload()).quantity, '600.000');
    assert.equal(rows[0].reservedQuantity, '400.000');
    const notices = await models.Notification.findAll({
      where: { orderId: order.id, recipientId: actors.f3.id },
    });
    assert.equal(notices.length, 1);
    assert.match(notices[0].title, /বিকল্প/);
    const own = await request(`orders/${order.id}`, { actor: 'f3' });
    assert.equal(own.data.order.portions.length, 1);
    assert.equal(own.data.order.totalQuantity, '400.000');
    assert.equal(JSON.stringify(own.data).includes(actors.f1.phone), false);
  });
  test('concurrent retries add one replacement batch and one set of reservations and reject reuse with another selection', async () => {
    const set = await setup(),
      rows = await candidates(set),
      preview = await quote(set, [rows[0]]),
      body = { quoteToken: preview.quoteToken, requestId: randomUUID() };
    const alternative = await quote(set, [rows[1], rows[2]]);
    const before = await models.Notification.count();
    const results = await Promise.all([
      request(path(set), { method: 'POST', body }),
      request(path(set), { method: 'POST', body }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    assert.equal(await models.OrderReplacement.count({ where: { orderId: set.order.id } }), 1);
    assert.equal(await models.Notification.count(), before + 2);
    assert.equal((await rows[0].reload()).reservedQuantity, '400.000');
    assert.equal(
      (
        await request(path(set), {
          method: 'POST',
          body: { quoteToken: alternative.quoteToken, requestId: body.requestId },
        })
      ).status,
      409,
    );
    assert.equal(
      (await request(`${path(set)}/quote`, { method: 'POST', body: { listingIds: [rows[1].id] } }))
        .status,
      409,
    );
    assert.deepEqual((await request(path(set))).data.recommendations, []);
  });
  test('different tabs cannot fill the same gap twice, and stale stock, prices or parent response changes require a fresh preview', async () => {
    for (const change of ['price', 'stock', 'another-tab', 'response']) {
      const set = await setup({ reject: change !== 'response' });
      if (change === 'response') {
        const declined = set.order.portions.find((p) => p.farmer.phone === actors.f2.phone);
        await respondToOrder(actors.f2.id, declined.id, { decision: 'rejected', version: 1 });
        set.order = (await request(`orders/${set.order.id}`)).data.order;
      }
      const rows = await candidates(set),
        preview = await quote(set, [rows[0]]);
      if (change === 'price') await rows[0].update({ pricePerUnit: '29.00', version: 2 });
      if (change === 'stock') await rows[0].update({ quantity: '399.000', version: 2 });
      if (change === 'another-tab') await confirm(set, [rows[1], rows[2]]);
      if (change === 'response') {
        const pending = set.order.portions.find((p) => p.farmer.phone === actors.f1.phone);
        await respondToOrder(actors.f1.id, pending.id, { decision: 'accepted', version: 1 });
      }
      const count = await models.OrderReplacement.count();
      assert.equal(
        (
          await request(path(set), {
            method: 'POST',
            body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          })
        ).status,
        409,
        change,
      );
      assert.equal(await models.OrderReplacement.count(), count);
      assert.equal((await rows[0].reload()).reservedQuantity, '0.000');
    }
  });
  test('partial replacement, repeated rejection and a later full replacement use the original target without counting history twice', async () => {
    const set = await setup(),
      rows = await candidates(set),
      partial = await confirm(set, [rows[3]]);
    assert.equal(partial.pendingQuantity, '80.000');
    assert.equal(partial.replacementNeededQuantity, '320.000');
    const portion = partial.portions.find((p) => p.farmer.phone === actors.f6.phone);
    await respondToOrder(actors.f6.id, portion.id, { decision: 'rejected', version: 1 });
    assert.equal((await rows[3].reload()).reservedQuantity, '0.000');
    assert.equal(rows[3].quantity, '80.000');
    let current = (await request(`orders/${set.order.id}`)).data.order;
    assert.equal(current.rejectedQuantity, '480.000');
    assert.equal(current.replacementNeededQuantity, '400.000');
    assert.equal(current.currentQuantity, '600.000');
    const full = await confirm(set, [rows[0]]),
      accepted = full.portions.find((p) => p.farmer.phone === actors.f3.phone);
    await respondToOrder(actors.f3.id, accepted.id, { decision: 'accepted', version: 1 });
    current = (await request(`orders/${set.order.id}`)).data.order;
    assert.equal(current.status, 'accepted');
    assert.equal(current.rejectedQuantity, '480.000');
    assert.equal(current.replacementNeededQuantity, '0.000');
    assert.equal(current.currentQuantity, '1000.000');
  });
  test('whole-lot replacements accept exactly 20% extra, reject any larger total and group several lots from one new farmer', async () => {
    const set = await setup(),
      rows = await models.CropListing.bulkCreate([
        { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, quantity: '240.000' },
        { ...fixture, cropName: set.cropName, farmerId: actors.f3.id, quantity: '240.000' },
        { ...fixture, cropName: set.cropName, farmerId: actors.f4.id, quantity: '0.001' },
      ]);
    assert.equal(
      (
        await request(`${path(set)}/quote`, {
          method: 'POST',
          body: { listingIds: rows.map((r) => r.id) },
        })
      ).status,
      409,
    );
    const order = await confirm(set, rows.slice(0, 2));
    assert.equal(order.currentQuantity, '1080.000');
    assert.equal(order.replacementNeededQuantity, '0.000');
    const portion = order.portions.find((p) => p.farmer.phone === actors.f3.phone);
    assert.equal(portion.items.length, 2);
    assert.equal(portion.quantity, '480.000');
  });
  test('a replacement and another buyer initial order cannot reserve the same stock twice', async () => {
    const set = await setup(),
      rows = await candidates(set, ['400.000']);
    const replacement = await quote(set, rows);
    const otherRequirement = await models.PurchaseRequirement.create({
      buyerId: actors.other.id,
      cropName: set.cropName,
      quantity: '400.000',
      unit: 'kg',
      deliveryAddress: 'অন্য ক্রেতার ডেলিভারি গুদাম',
    });
    const initial = await previewOrder(actors.other.id, {
      requirementId: otherRequirement.id,
      listingIds: [rows[0].id],
    });
    const results = await Promise.all([
      request(path(set), {
        method: 'POST',
        body: { quoteToken: replacement.quoteToken, requestId: randomUUID() },
      }),
      request('orders', {
        method: 'POST',
        actor: 'other',
        body: { quoteToken: initial.quoteToken, requestId: randomUUID() },
      }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    await rows[0].reload();
    assert.equal(rows[0].quantity, '0.000');
    assert.equal(rows[0].reservedQuantity, '400.000');
  });
  test('quotes from initial orders and other replacement orders cannot be replayed across endpoints', async () => {
    const set = await setup(),
      rows = await candidates(set),
      preview = await quote(set, [rows[0]]);
    assert.equal(
      (
        await request('orders', {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
        })
      ).status,
      409,
    );
    const other = await setup();
    await candidates(other);
    assert.equal(
      (
        await request(path(other), {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
        })
      ).status,
      409,
    );
    const untouched = await setup({ reject: false });
    const initial = await previewOrder(actors.buyer.id, {
      requirementId: untouched.requirement.id,
      listingIds: [
        (
          await models.CropListing.create({
            ...fixture,
            cropName: untouched.cropName,
            farmerId: actors.f4.id,
          })
        ).id,
      ],
    });
    assert.equal(
      (
        await request(path(set), {
          method: 'POST',
          body: { quoteToken: initial.quoteToken, requestId: randomUUID() },
        })
      ).status,
      409,
    );
  });
  test('an initially partial order only replaces its rejected ordered part; empty and pending-only orders return no suggestions', async () => {
    const set = await setup({ requested: '1200.000' });
    await candidates(set);
    const result = await request(path(set));
    assert.equal(result.data.remainingQuantity, '400.000');
    const pending = await setup({ reject: false });
    assert.equal((await request(path(pending))).data.remainingQuantity, '0.000');
    assert.deepEqual((await request(`${path(pending)}/listings`)).data.listings, []);
    const empty = await setup();
    assert.deepEqual((await request(path(empty))).data.recommendations, []);
  });
}
