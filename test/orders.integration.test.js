import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.AUTH_INTEGRATION !== '1') {
  test(
    'MySQL order and notification integration tests (npm run test:integration)',
    { skip: true },
    () => {},
  );
} else {
  if (!/^fb_test_[a-f0-9]{12}_$/.test(process.env.AUTH_TEST_TABLE_PREFIX || ''))
    throw new Error('Isolated tables required');
  const { app } = await import('../src/app.js'),
    { sequelize } = await import('../src/config/database.js'),
    { models } = await import('../src/models/index.js');
  const { migrationRunner } = await import('../src/config/migrations.js'),
    { env } = await import('../src/config/env.js');
  const { hashPassword } = await import('../src/lib/crypto.js'),
    { newSession } = await import('../src/services/auth.js');
  const { editListing } = await import('../src/services/listings.js');
  const { readOrder, listOrders } = await import('../src/services/orders.js');
  const actors = {},
    cookies = {};
  let server,
    base,
    index = 0;
  const fixture = {
    cropName: 'পরীক্ষার ধান',
    quantity: '1000.000',
    unit: 'kg',
    pricePerUnit: '20.00',
    harvestDate: '2026-11-23',
    availableDate: '2026-11-25',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    farmAddress: 'পরীক্ষার খামারের ঠিকানা',
    description: 'পরীক্ষার ফসলের বিবরণ',
    photoFilenames: ['c382327b-5682-4ab4-baf6-2d70ec977eb5.webp'],
  };
  before(async () => {
    await migrationRunner(sequelize).up();
    const passwordHash = await hashPassword('OrderTest123');
    for (const [i, name] of [
      'buyer',
      'other',
      'pending',
      'admin',
      'farmer1',
      'farmer2',
      'farmer3',
    ].entries()) {
      const role = name.startsWith('farmer') ? 'farmer' : name === 'admin' ? 'admin' : 'buyer';
      actors[name] = await models.User.create({
        role,
        fullName: `পরীক্ষার ${name}`,
        phone: `0190000006${i}`,
        passwordHash,
        phoneVerifiedAt: role === 'farmer' ? new Date() : null,
      });
      if (role === 'buyer')
        await models.BuyerProfile.create({
          userId: actors[name].id,
          businessName: 'পরীক্ষার ব্যবসা',
          businessType: 'পাইকারি',
          address: 'পরীক্ষার গুদাম, ঢাকা',
          status: name === 'pending' ? 'pending' : 'approved',
          submittedAt: new Date(),
        });
      if (role === 'farmer')
        await models.FarmerProfile.create({
          userId: actors[name].id,
          nid: `123456780${i}`,
          district: 'বগুড়া',
          upazila: 'শিবগঞ্জ',
          village: 'মহাস্থান',
          farmAddress: 'কৃষকের প্রোফাইলের ঠিকানা',
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
  async function setup(
    quantities = ['1000.000'],
    requested = '600.000',
    buyer = 'buyer',
    farmers = ['farmer1', 'farmer2', 'farmer3'],
  ) {
    const cropName = `অর্ডারের ধান ${++index}`;
    const requirement = await models.PurchaseRequirement.create({
      buyerId: actors[buyer].id,
      cropName,
      quantity: requested,
      unit: 'kg',
      deliveryAddress: 'পরীক্ষার ডেলিভারি গুদাম, ঢাকা',
      instructions: 'শুকনো বস্তায় প্যাকেট করুন।',
    });
    const listings = await models.CropListing.bulkCreate(
      quantities.map((quantity, i) => ({
        ...fixture,
        cropName,
        quantity,
        farmerId: actors[farmers[i % farmers.length]].id,
      })),
    );
    return { requirement, listings };
  }
  async function quote(set, actor = 'buyer') {
    const result = await request('orders/quote', {
      method: 'POST',
      body: { requirementId: set.requirement.id, listingIds: set.listings.map((row) => row.id) },
      actor,
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  }
  async function place(set, actor = 'buyer') {
    const preview = await quote(set, actor);
    const result = await request('orders', {
      method: 'POST',
      body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
      actor,
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.order;
  }
  async function respond(order, farmer, decision = 'accepted') {
    const portion = order.portions.find((p) => p.farmer.phone === actors[farmer].phone);
    return request(`orders/portions/${portion.id}/respond`, {
      method: 'POST',
      body: { decision, version: portion.version },
      actor: farmer,
    });
  }

  test('quotes reserve nothing; confirmation reserves only the individual requested quantity, snapshots details and atomically creates notifications', async () => {
    const set = await setup(),
      quoted = await quote(set);
    await set.listings[0].reload();
    assert.equal(set.listings[0].quantity, '1000.000');
    assert.equal(set.listings[0].reservedQuantity, '0.000');
    assert.equal(quoted.preview.totalQuantity, '600.000');
    const result = await request('orders', {
      method: 'POST',
      body: { quoteToken: quoted.quoteToken, requestId: randomUUID() },
    });
    assert.equal(result.status, 201);
    const order = result.data.order;
    assert.equal(order.totalCost, '12000.00');
    assert.equal(order.pendingQuantity, '600.000');
    assert.equal(order.portions[0].items[0].farmAddress, fixture.farmAddress);
    await set.listings[0].reload();
    assert.equal(set.listings[0].quantity, '400.000');
    assert.equal(set.listings[0].reservedQuantity, '600.000');
    assert.equal(set.listings[0].version, 2);
    assert.equal(await models.Notification.count({ where: { orderId: order.id } }), 2);
    await set.requirement.reload();
    assert.equal(set.requirement.editCount, 0);
    assert.equal(set.requirement.version, 1);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  });
  test('quote and placement enforce approval, ownership, roles, origins and signed selections', async () => {
    const set = await setup(),
      body = { requirementId: set.requirement.id, listingIds: set.listings.map((r) => r.id) };
    assert.equal((await request('orders/quote', { method: 'POST', body, actor: '' })).status, 401);
    for (const actor of ['farmer1', 'admin', 'pending'])
      assert.equal((await request('orders/quote', { method: 'POST', body, actor })).status, 403);
    assert.equal(
      (await request('orders/quote', { method: 'POST', body, actor: 'other' })).status,
      404,
    );
    assert.equal(
      (await request('orders/quote', { method: 'POST', body, origin: 'https://other.example' }))
        .status,
      403,
    );
    const preview = await quote(set);
    assert.equal(
      (
        await request('orders', {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID(), totalCost: '1' },
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request('orders', {
          method: 'POST',
          body: { quoteToken: preview.quoteToken.slice(0, -1) + '!', requestId: randomUUID() },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request('orders', {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          actor: 'other',
        })
      ).status,
      409,
    );
    await models.BuyerProfile.update({ status: 'pending' }, { where: { userId: actors.buyer.id } });
    assert.equal(
      (
        await request('orders', {
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
    assert.equal((await set.listings[0].reload()).reservedQuantity, '0.000');
  });
  test('stale prices, quantities, requirement edits and closed selections never create or partially reserve an order', async () => {
    for (const change of ['price', 'quantity', 'status', 'requirement']) {
      const set = await setup(['600.000', '400.000'], '1000.000'),
        preview = await quote(set);
      if (change === 'requirement')
        await set.requirement.update({ deliveryAddress: 'অন্য ডেলিভারি গুদাম', version: 2 });
      else
        await set.listings[1].update({
          ...(change === 'price'
            ? { pricePerUnit: '25.00' }
            : change === 'quantity'
              ? { quantity: '300.000' }
              : { status: 'inactive' }),
          version: 2,
        });
      const count = await models.Order.count(),
        notices = await models.Notification.count();
      assert.equal(
        (
          await request('orders', {
            method: 'POST',
            body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          })
        ).status,
        409,
        change,
      );
      assert.equal(await models.Order.count(), count);
      assert.equal(await models.Notification.count(), notices);
      assert.equal((await set.listings[0].reload()).reservedQuantity, '0.000');
    }
  });
  test('repeated and concurrent retries create one order and one set of notifications; a reused key cannot change selections', async () => {
    const set = await setup(),
      preview = await quote(set),
      requestId = randomUUID(),
      body = { quoteToken: preview.quoteToken, requestId };
    const results = await Promise.all([
      request('orders', { method: 'POST', body }),
      request('orders', { method: 'POST', body }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    assert.equal(results[0].data.order.id, results[1].data.order.id);
    assert.equal(
      await models.Notification.count({ where: { orderId: results[0].data.order.id } }),
      2,
    );
    assert.equal((await set.listings[0].reload()).reservedQuantity, '600.000');
    const other = await quote(await setup());
    assert.equal(
      (
        await request('orders', {
          method: 'POST',
          body: { quoteToken: other.quoteToken, requestId },
        })
      ).status,
      409,
    );
  });
  test('two buyers racing for the same stock cannot oversell or bypass the displayed quote', async () => {
    const set = await setup(),
      other = {
        ...set,
        requirement: await models.PurchaseRequirement.create({
          buyerId: actors.other.id,
          cropName: set.requirement.cropName,
          quantity: '600.000',
          unit: 'kg',
          deliveryAddress: 'অন্য ক্রেতার গুদাম, ঢাকা',
        }),
      };
    const quotes = await Promise.all([quote(set), quote(other, 'other')]);
    const results = await Promise.all(
      quotes.map((preview, i) =>
        request('orders', {
          method: 'POST',
          body: { quoteToken: preview.quoteToken, requestId: randomUUID() },
          actor: i ? 'other' : 'buyer',
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    await set.listings[0].reload();
    assert.equal(set.listings[0].quantity, '400.000');
    assert.equal(set.listings[0].reservedQuantity, '600.000');
  });
  test('collective orders keep one response per distinct farmer; farmers only see and answer their own portions', async () => {
    const set = await setup(['300.000', '300.000', '400.000'], '1000.000', 'buyer', [
        'farmer1',
        'farmer1',
        'farmer2',
      ]),
      order = await place(set);
    assert.equal(order.portions.length, 2);
    assert.equal(
      order.portions.find((p) => p.farmer.phone === actors.farmer1.phone).items.length,
      2,
    );
    const farmer = await request(`orders/${order.id}`, { actor: 'farmer1' });
    assert.equal(farmer.status, 200);
    assert.equal(farmer.data.order.portions.length, 1);
    assert.equal(farmer.data.order.totalQuantity, '600.000');
    assert.equal(JSON.stringify(farmer.data).includes(actors.farmer2.phone), false);
    assert.equal((await request(`orders/${order.id}`, { actor: 'other' })).status, 404);
    assert.equal((await request(`orders/${order.id}`, { actor: 'farmer3' })).status, 404);
    const foreign = order.portions.find((p) => p.farmer.phone === actors.farmer2.phone);
    assert.equal(
      (
        await request(`orders/portions/${foreign.id}/respond`, {
          method: 'POST',
          actor: 'farmer1',
          body: { decision: 'accepted', version: 1 },
        })
      ).status,
      404,
    );
    const before = await models.Notification.count({ where: { orderId: order.id } });
    assert.equal((await respond(order, 'farmer1')).status, 200);
    assert.equal((await respond(order, 'farmer1')).status, 200);
    assert.equal(await models.Notification.count({ where: { orderId: order.id } }), before + 1);
    const own = order.portions.find((p) => p.farmer.phone === actors.farmer1.phone);
    assert.equal(
      (
        await request(`orders/portions/${own.id}/respond`, {
          method: 'POST',
          actor: 'farmer1',
          body: { decision: 'rejected', version: 1 },
        })
      ).status,
      409,
    );
    const buyer = (await request(`orders/${order.id}`)).data.order;
    assert.equal(buyer.acceptedQuantity, '600.000');
    assert.equal(buyer.pendingQuantity, '400.000');
  });
  test('rejection releases all of the farmer lots exactly once; concurrent responses produce accurate buyer totals', async () => {
    const set = await setup(['300.000', '300.000', '400.000'], '1000.000', 'buyer', [
        'farmer1',
        'farmer1',
        'farmer2',
      ]),
      order = await place(set);
    const results = await Promise.all([
      respond(order, 'farmer1', 'rejected'),
      respond(order, 'farmer2', 'accepted'),
    ]);
    assert(results.every((r) => r.status === 200));
    assert.equal((await respond(order, 'farmer1', 'rejected')).status, 200);
    for (const listing of set.listings.slice(0, 2)) {
      await listing.reload();
      assert.equal(listing.quantity, '300.000');
      assert.equal(listing.reservedQuantity, '0.000');
    }
    await set.listings[2].reload();
    assert.equal(set.listings[2].quantity, '0.000');
    assert.equal(set.listings[2].reservedQuantity, '400.000');
    const buyer = (await request(`orders/${order.id}`)).data.order;
    assert.equal(buyer.status, 'partially_accepted');
    assert.equal(buyer.acceptedQuantity, '400.000');
    assert.equal(buyer.rejectedQuantity, '600.000');
    assert.equal(buyer.unfulfilledQuantity, '600.000');
    const notifications = await models.Notification.findAll({
      where: { orderId: order.id, recipientId: actors.buyer.id },
      order: [['createdAt', 'DESC']],
    });
    assert(
      notifications.some(
        (n) => n.message.includes('গৃহীত ৪০০') && n.message.includes('উত্তরের অপেক্ষায় ০'),
      ),
    );
  });
  test('pending answers never expire, accepted quantities stay reserved, and destructive listing changes cannot erase holds', async () => {
    const set = await setup(),
      order = await place(set),
      listing = await set.listings[0].reload();
    await models.OrderPortion.update(
      { createdAt: new Date('2020-01-01') },
      { where: { id: order.portions[0].id }, silent: true },
    );
    assert.equal((await request(`orders/${order.id}`)).data.order.portions[0].status, 'pending');
    assert.equal(
      (
        await request(`farmer/listings/${listing.id}`, {
          method: 'DELETE',
          actor: 'farmer1',
          body: { version: listing.version },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`farmer/listings/${listing.id}/status`, {
          method: 'PATCH',
          actor: 'farmer1',
          body: { status: 'sold_out', version: listing.version },
        })
      ).status,
      409,
    );
    const input = {
      ...fixture,
      quantity: '400.000',
      cropName: 'লাল আলু',
      retainedPhotos: JSON.stringify(fixture.photoFilenames),
      version: listing.version,
    };
    delete input.photoFilenames;
    await assert.rejects(
      editListing(actors.farmer1.id, listing.id, input),
      (error) => error.status === 409,
    );
    await assert.rejects(
      editListing(actors.farmer1.id, listing.id, {
        ...input,
        cropName: listing.cropName,
        quantity: '999999999.999',
      }),
      (error) => error.status === 422,
    );
    assert.equal((await respond(order, 'farmer1')).status, 200);
    await listing.reload();
    assert.equal(listing.reservedQuantity, '600.000');
  });
  test('order snapshots survive listing price/name edits and requirement deletion; rejection respects a paused listing', async () => {
    const set = await setup(),
      order = await place(set),
      listing = await set.listings[0].reload();
    await listing.update({
      pricePerUnit: '99.00',
      status: 'inactive',
      version: listing.version + 1,
    });
    await set.requirement.destroy();
    const before = (await request(`orders/${order.id}`)).data.order;
    assert.equal(before.totalCost, '12000.00');
    assert.equal(before.requirementId, null);
    assert.equal(before.portions[0].items[0].pricePerUnit, '20.00');
    assert.equal((await respond(order, 'farmer1', 'rejected')).status, 200);
    await listing.reload();
    assert.equal(listing.quantity, '1000.000');
    assert.equal(listing.status, 'inactive');
    assert.equal(
      (
        await request(`farmer/listings/${listing.id}`, {
          method: 'DELETE',
          actor: 'farmer1',
          body: { version: listing.version },
        })
      ).status,
      200,
    );
    const history = (await request(`orders/${order.id}`)).data.order;
    assert.equal(history.portions[0].items[0].listingId, null);
    assert.equal(history.portions[0].items[0].farmAddress, fixture.farmAddress);
  });
  test('notification history, unread counts, mark-read and mark-all are private and idempotent', async () => {
    const set = await setup(),
      order = await place(set);
    const all = await request('notifications', { actor: 'farmer1' });
    assert.equal(all.status, 200);
    assert(all.data.unreadCount > 0);
    const notice = all.data.notifications.find((n) => n.orderId === order.id);
    assert(notice);
    assert.equal(all.headers.get('cache-control'), 'no-store');
    assert.equal(
      (
        await request(`notifications/${notice.id}/read`, {
          method: 'POST',
          body: {},
          actor: 'farmer2',
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(`notifications/${notice.id}/read`, {
          method: 'POST',
          body: {},
          actor: 'farmer1',
        })
      ).status,
      200,
    );
    const first = await models.Notification.findByPk(notice.id),
      readTime = first.readAt.getTime();
    assert.equal(
      (
        await request(`notifications/${notice.id}/read`, {
          method: 'POST',
          body: {},
          actor: 'farmer1',
        })
      ).status,
      200,
    );
    assert.equal((await first.reload()).readAt.getTime(), readTime);
    assert.equal(
      (await request('notifications/read-all', { method: 'POST', body: {}, actor: 'farmer1' }))
        .status,
      200,
    );
    assert.equal((await request('notifications/count', { actor: 'farmer1' })).data.unreadCount, 0);
    assert.equal((await request('notifications', { actor: 'admin' })).status, 403);
    assert.equal((await request('notifications', { actor: '' })).status, 401);
    assert.equal(
      (
        await request(`notifications/${notice.id}/read`, {
          method: 'POST',
          body: {},
          actor: 'farmer1',
          origin: 'https://other.example',
        })
      ).status,
      403,
    );
  });
  test('one farm can fill a demand across lots ahead of cheaper multi-farm matches, at the advertised cost', async () => {
    const set = await setup(['65', '60', '35', '35'], '100', 'buyer', [
      'farmer1', 'farmer1', 'farmer2', 'farmer3',
    ]);
    await set.listings[1].update({ pricePerUnit: '500.00', availableDate: '2027-01-01' });
    const path = `buyer/requirements/${set.requirement.id}/combinations`;
    for (const sort of ['recommended', 'price_asc', 'available_asc']) {
      const { data } = await request(`${path}?sort=${sort}`);
      const [first] = data.combinations;
      assert.equal(first.farmerCount, 1);
      assert.equal(first.fulfilment, 'exact');
      assert.equal(first.quantity, '100.000');
    }
    const { data } = await request(path);
    const [match] = data.combinations;
    assert.ok(data.combinations.some((c) => c.farmerCount === 2 && c.fulfilment === 'exact'));
    assert.equal(match.farmerCount, 1);
    assert.equal(match.listings.find((row) => row.id === set.listings[1].id).proposedQuantity, '35.000');
    const order = await place({ ...set, listings: set.listings.slice(0, 2) });
    assert.equal(order.totalQuantity, match.quantity);
    assert.equal(order.totalCost, match.totalCost);
    assert.equal(order.portions.length, 1);
    assert.equal((await set.listings[1].reload()).quantity, '25.000');
  });

  test('partial and exactly 20% excess orders reserve complete collective lots while excessive and inactive selections fail', async () => {
    for (const [quantities, total] of [
      [['350.000', '450.000'], '800.000'],
      [['600.000', '300.000'], '900.000'],
      [['600.000', '600.000'], '1200.000'],
    ]) {
      const set = await setup(quantities, '1000.000'),
        order = await place(set);
      assert.equal(order.totalQuantity, total);
      for (const row of set.listings) {
        await row.reload();
        assert.equal(row.quantity, '0.000');
      }
    }
    for (const lots of [['350.000', '449.999'], ['600.000', '600.001']]) {
      const set = await setup(lots, '1000.000');
      const quote = await request('orders/quote', {
        method: 'POST',
        body: { requirementId: set.requirement.id, listingIds: set.listings.map((row) => row.id) },
      });
      assert.equal(quote.status, 409);
    }
    const inactive = await setup();
    await inactive.requirement.update({ status: 'inactive' });
    assert.equal(
      (
        await request('orders/quote', {
          method: 'POST',
          body: {
            requirementId: inactive.requirement.id,
            listingIds: inactive.listings.map((row) => row.id),
          },
        })
      ).status,
      409,
    );
    const malformed = await request('orders', {
      method: 'POST',
      body: { requestId: randomUUID(), quoteToken: `body.${'ক'.repeat(43)}` },
    });
    assert.equal(malformed.status, 409);
  });
  test('order pagination, private snapshots and list scope omit credentials and other users data', async () => {
    await assert.rejects(
      listOrders({ id: actors.admin.id, role: 'admin' }, {}),
      (error) => error.status === 403,
    );
    await assert.rejects(
      readOrder({ id: actors.admin.id, role: 'admin' }, randomUUID()),
      (error) => error.status === 403,
    );
    const buyer = await request('orders'),
      farmer = await request('orders', { actor: 'farmer1' });
    assert.equal(buyer.status, 200);
    assert.equal(farmer.status, 200);
    assert(buyer.data.orders.length <= 12);
    assert(
      farmer.data.orders.every(
        (o) => o.portions.length === 1 && o.portions[0].farmer.phone === actors.farmer1.phone,
      ),
    );
    for (const data of [buyer.data, farmer.data])
      for (const key of [
        'passwordHash',
        'nid',
        'email',
        'requestHash',
        'requestId',
        'buyerId',
        'farmerId',
      ])
        assert(!JSON.stringify(data).includes(`"${key}"`));
    assert.equal((await request('orders?page=100')).data.orders.length, 0);
    assert.equal((await request('orders?buyerId=someone')).status, 422);
    assert.equal((await request('orders/not-an-id')).status, 404);
  });
}
