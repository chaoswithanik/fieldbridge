import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

if (process.env.AUTH_INTEGRATION !== '1') {
  test(
    'MySQL collective matching integration tests (npm run test:integration)',
    { skip: true },
    () => {},
  );
} else {
  if (!/^fb_test_[a-f0-9]{12}_$/.test(process.env.AUTH_TEST_TABLE_PREFIX || ''))
    throw new Error('Isolated tables required');
  const { app } = await import('../src/app.js');
  const { sequelize } = await import('../src/config/database.js');
  const { models } = await import('../src/models/index.js');
  const { env } = await import('../src/config/env.js');
  const { migrationRunner } = await import('../src/config/migrations.js');
  const { hashPassword } = await import('../src/lib/crypto.js');
  const { newSession } = await import('../src/services/auth.js');
  const { collectiveRequirementMatches } = await import('../src/services/matching.js');
  let server, base, requirement, passwordHash;
  const actors = {},
    cookies = {},
    listings = [];
  const fixture = {
    cropName: 'আমন ধান',
    quantity: '60.000',
    unit: 'kg',
    pricePerUnit: '20.00',
    harvestDate: '2026-11-23',
    availableDate: '2026-11-25',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    farmAddress: 'পরীক্ষার ফসলের খামারের ঠিকানা',
    description: 'পরীক্ষার ফসলের বিবরণ',
    photoFilenames: ['c382327b-5682-4ab4-baf6-2d70ec977eb5.webp'],
  };
  before(async () => {
    await migrationRunner(sequelize).up();
    passwordHash = await hashPassword('CollectiveTest123');
    for (const [i, name] of [
      'buyer',
      'other',
      'pending',
      'admin',
      'farmer1',
      'farmer2',
      'farmer3',
      'unverified',
    ].entries()) {
      const role =
        name.startsWith('farmer') || name === 'unverified'
          ? 'farmer'
          : name === 'admin'
            ? 'admin'
            : 'buyer';
      actors[name] = await models.User.create({
        role,
        fullName: `পরীক্ষার ${name}`,
        phone: `0190000007${i}`,
        passwordHash,
        phoneVerifiedAt: role === 'farmer' && name !== 'unverified' ? new Date() : null,
      });
      if (role === 'buyer')
        await models.BuyerProfile.create({
          userId: actors[name].id,
          businessName: 'পরীক্ষার প্রতিষ্ঠান',
          businessType: 'পাইকারি',
          address: 'পরীক্ষার গুদাম, ঢাকা',
          status: name === 'pending' ? 'pending' : 'approved',
          submittedAt: new Date(),
        });
      if (role === 'farmer')
        await models.FarmerProfile.create({
          userId: actors[name].id,
          nid: `123456789${i}`,
          district: 'বগুড়া',
          upazila: 'শিবগঞ্জ',
          village: 'মহাস্থান',
          farmAddress: 'পরীক্ষার প্রোফাইলের ঠিকানা',
          farmName: 'পরীক্ষার কৃষি খামার',
        });
      cookies[name] = `fieldbridge_session=${(await newSession(actors[name].id)).token}`;
    }
    requirement = await models.PurchaseRequirement.create({
      buyerId: actors.buyer.id,
      cropName: fixture.cropName,
      quantity: '100.000',
      unit: 'kg',
      deliveryAddress: 'পরীক্ষার গুদাম, ঢাকা',
    });
    listings.push(
      ...(await models.CropListing.bulkCreate([
        { ...fixture, farmerId: actors.farmer1.id },
        {
          ...fixture,
          farmerId: actors.farmer2.id,
          quantity: '40.000',
          availableDate: '2026-11-26',
          pricePerUnit: '30.00',
        },
        {
          ...fixture,
          farmerId: actors.farmer3.id,
          quantity: '50.000',
          district: 'রংপুর',
          upazila: 'পীরগাছা',
          pricePerUnit: '10.00',
        },
        { ...fixture, farmerId: actors.farmer3.id, quantity: '1000.000' },
        { ...fixture, farmerId: actors.farmer3.id, quantity: '40.000', status: 'inactive' },
        { ...fixture, farmerId: actors.farmer3.id, quantity: '40.000', status: 'sold_out' },
        { ...fixture, farmerId: actors.farmer3.id, quantity: '0.000' },
        { ...fixture, farmerId: actors.farmer3.id, cropName: 'আমন ধান চাল' },
        { ...fixture, farmerId: actors.farmer3.id, unit: 'ton' },
        { ...fixture, farmerId: actors.unverified.id, quantity: '40.000' },
      ])),
    );
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
  async function request(path = `/${requirement.id}/combinations`, cookie = cookies.buyer) {
    const response = await fetch(`${base}${path}`, {
      headers: { ...(cookie ? { Cookie: cookie } : {}) },
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }

  test('collective results use active exact-name/unit verified stock, return whole lots and exact/excess/partial tiers', async () => {
    const result = await request();
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.combinations.length, 5);
    assert.deepEqual(
      result.data.combinations.map((c) => c.fulfilment),
      ['exact', 'excess', 'partial', 'partial', 'partial'],
    );
    assert.deepEqual(
      result.data.combinations.map((c) => c.quantity),
      ['100.000', '110.000', '50.000', '60.000', '40.000'],
    );
    assert.equal(result.data.combinations[0].availableDate, '2026-11-26');
    assert.equal(result.data.combinations[0].totalCost, '2400.00');
    assert.equal(result.data.combinations[1].excessQuantity, '10.000');
    assert.equal(result.data.combinations[2].shortageQuantity, '50.000');
    assert.equal(result.data.combinations[1].proximity.differentDistrictPairs, 1);
    assert(
      result.data.combinations
        .flatMap((c) => c.listings)
        .every((l) => listings.slice(0, 3).some((row) => row.id === l.id)),
    );
    assert.equal(result.headers.get('cache-control'), 'no-store');
  });
  test('collective farmer contact is explicitly whitelisted and no private account data leaks through nested members', async () => {
    for (const combination of (await request()).data.combinations)
      for (const listing of combination.listings) {
        assert.deepEqual(Object.keys(listing.farmer).sort(), [
          'farmAddress',
          'farmName',
          'fullName',
          'phone',
        ]);
        assert.equal(listing.farmer.farmAddress, fixture.farmAddress);
        assert.match(listing.farmer.phone, /^0190000007/);
        for (const key of ['farmerId', 'passwordHash', 'nid', 'email', 'tokenHash', 'buyerId'])
          assert(!JSON.stringify(listing).includes(`"${key}"`));
      }
  });
  test('collective endpoints enforce owner approval and role on an existing session and inside the service transaction', async () => {
    assert.equal((await request(undefined, '')).status, 401);
    for (const name of ['pending', 'admin', 'farmer1'])
      assert.equal((await request(undefined, cookies[name])).status, 403);
    assert.equal((await request(undefined, cookies.other)).status, 404);
    assert.equal((await request('/invalid/combinations')).status, 404);
    for (const status of ['pending', 'rejected']) {
      await models.BuyerProfile.update({ status }, { where: { userId: actors.buyer.id } });
      assert.equal((await request()).status, 403);
      await assert.rejects(
        collectiveRequirementMatches(actors.buyer.id, requirement.id),
        (error) => error.status === 403,
      );
    }
    await models.BuyerProfile.update(
      { status: 'approved' },
      { where: { userId: actors.buyer.id } },
    );
  });
  test('collective queries cannot override requirement fields, farmer caps or excess tolerance', async () => {
    for (const query of [
      'quantity=1',
      'cropName=ধান',
      'unit=ton',
      'buyerId=other',
      'maxFarmers=2',
      'tolerance=100',
      'page=1',
      'sort=constructor',
      'sort=price_asc&sort=farmers_asc',
    ])
      assert.equal((await request(`/${requirement.id}/combinations?${query}`)).status, 422, query);
    for (const sort of [
      'recommended',
      'price_asc',
      'available_asc',
      'harvest_asc',
      'farmers_asc',
      'proximity_asc',
    ]) {
      const result = await request(`/${requirement.id}/combinations?sort=${sort}`);
      assert.equal(result.status, 200);
      assert.equal(result.data.sort, sort);
      assert.equal(result.data.combinations[0].fulfilment, 'exact');
    }
  });
  test('collective matches follow stock and requirement changes without spending edits or changing version', async () => {
    await listings[1].update({ quantity: '0.000' });
    let result = await request();
    assert.equal(result.data.combinations.length, 3);
    assert.equal(result.data.combinations[0].fulfilment, 'excess');
    await requirement.update({
      quantity: '200.000',
      editCount: 2,
      status: 'fulfilled',
      version: 5,
    });
    result = await request();
    assert.equal(result.data.combinations[0].fulfilment, 'partial');
    assert.equal(result.data.requirement.quantity, '200.000');
    assert.equal(result.data.requirement.editCount, 2);
    await requirement.reload();
    assert.equal(requirement.version, 5);
    assert.equal(requirement.editCount, 2);
    await listings[0].update({ status: 'inactive' });
    result = await request();
    assert.equal(result.data.combinations.length, 1);
    assert.equal(result.data.combinations[0].fulfilment, 'partial');
    assert.equal(result.data.combinations[0].farmerCount, 1);
    await listings[0].update({ status: 'active' });
    await listings[1].update({ quantity: '40.000' });
  });
  test('collective searches preserve decimal prices and total cost without number rounding overflow', async () => {
    const cropName = 'বিশেষ দশমিক ধান';
    await requirement.update({ cropName, quantity: '0.003' });
    await models.CropListing.bulkCreate([
      {
        ...fixture,
        cropName,
        farmerId: actors.farmer1.id,
        quantity: '0.001',
        pricePerUnit: '2.50',
      },
      {
        ...fixture,
        cropName,
        farmerId: actors.farmer2.id,
        quantity: '0.002',
        pricePerUnit: '2.50',
      },
    ]);
    const match = (await request()).data.combinations[0];
    assert.equal(match.fulfilment, 'exact');
    assert.equal(match.quantity, '0.003');
    assert.equal(match.totalCost, '0.01');
    assert.equal(match.listings.find((l) => l.quantity === '0.001').subtotal, '0.00');
    await models.CropListing.update(
      { quantity: '0.001', pricePerUnit: '5.00' },
      { where: { cropName } },
    );
    await requirement.update({ quantity: '0.002' });
    const rounded = (await request()).data.combinations[0];
    assert.equal(rounded.totalCost, '0.02');
    assert(rounded.listings.every((listing) => listing.subtotal === '0.01'));
  });
  test('collective response caps results at five, counts unique farmers and returns 404 after deletion', async () => {
    await requirement.update({ cropName: 'অনেক সমন্বয়ের ধান', quantity: '100.000' });
    await models.CropListing.bulkCreate(
      Array.from({ length: 6 }, (_, i) => ({
        ...fixture,
        cropName: requirement.cropName,
        quantity: i % 2 ? '60.000' : '40.000',
        farmerId: actors[`farmer${(i % 3) + 1}`].id,
      })),
    );
    const result = await request();
    assert.equal(result.data.combinations.length, 5);
    for (const match of result.data.combinations) {
      const rows = await models.CropListing.findAll({
        where: { id: match.listings.map((l) => l.id) },
      });
      assert.equal(match.farmerCount, new Set(rows.map((r) => r.farmerId)).size);
      assert(match.farmerCount >= 1);
    }
    await requirement.destroy();
    assert.equal((await request()).status, 404);
  });
}
