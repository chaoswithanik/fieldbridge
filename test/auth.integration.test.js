import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';

if (process.env.AUTH_INTEGRATION !== '1') {
  test(
    'MySQL authentication integration tests (npm run test:integration)',
    { skip: true },
    () => {},
  );
} else {
  if (!/^fb_test_[a-f0-9]{12}_$/.test(process.env.AUTH_TEST_TABLE_PREFIX || ''))
    throw new Error('Integration tests require isolated test tables.');
  const { app } = await import('../src/app.js');
  const { sequelize } = await import('../src/config/database.js');
  const { env } = await import('../src/config/env.js');
  const { models } = await import('../src/models/index.js');
  const { migrationRunner } = await import('../src/config/migrations.js');
  const { tokenDigest, otpDigest } = await import('../src/lib/crypto.js');
  const { deleteAvatar } = await import('../src/services/avatar.js');
  const { deleteListingPhotos, listingPhotoDirectory } =
    await import('../src/services/listing-photos.js');
  const { newSession } = await import('../src/services/auth.js');
  const { access, readdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { default: sharp } = await import('sharp');
  const { spawn } = await import('node:child_process');
  const codes = new Map();
  let server, base, primaryCookie, primaryUser;
  const profile = {
    fullName: 'পরীক্ষার কৃষক',
    phone: '01900000001',
    password: 'FieldBridge!পরীক্ষা123',
    confirmPassword: 'FieldBridge!পরীক্ষা123',
    nid: '1234567890',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    village: 'মহাস্থান',
    farmAddress: 'মহাস্থান, শিবগঞ্জ, বগুড়া',
    email: 'farmer@example.test',
    farmName: 'পরীক্ষার খামার',
  };

  before(async () => {
    mock.method(console, 'info', (line) => {
      const match = String(line).match(/ফোন: (\d+) \| কোড: (\d{6})/);
      if (match) codes.set(match[1], match[2]);
    });
    const runner = migrationRunner(sequelize);
    await runner.up();
    assert.equal((await runner.pending()).length, 0);
    assert.equal((await runner.up()).length, 0);
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', (error) =>
        error ? reject(error) : resolve(instance),
      );
    });
    base = `http://127.0.0.1:${server.address().port}/api/auth`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const photos = await models.FarmerProfile.findAll({ attributes: ['avatarFilename'] }).catch(
      () => [],
    );
    await Promise.all(photos.map((row) => deleteAvatar(row.avatarFilename)));
    const crops = await models.CropListing.findAll({ attributes: ['photoFilenames'] }).catch(
      () => [],
    );
    await Promise.all(crops.map((row) => deleteListingPhotos(row.photoFilenames)));
    await sequelize.close();
    mock.restoreAll();
  });

  async function request(path, { method = 'GET', body, cookie, origin = env.clientOrigin } = {}) {
    const form = body instanceof FormData;
    const response = await fetch(
      path.startsWith('/api/') ? new URL(path, base) : `${base}${path}`,
      {
        method,
        headers: {
          Origin: origin,
          ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
      },
    );
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie'),
    };
  }
  async function otp(phone) {
    const result = await request('/farmers/otp', { method: 'POST', body: { phone } });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert(!('code' in result.data));
    assert(codes.has(phone));
    return { challengeId: result.data.challengeId, code: codes.get(phone) };
  }
  const cookiePair = (value) => value?.split(';')[0];

  test('registration requires a valid OTP and forces the farmer role', async () => {
    const verification = await otp(profile.phone);
    const wrong = await request('/farmers/register', {
      method: 'POST',
      body: { ...profile, ...verification, code: '000000' },
    });
    assert.equal(wrong.status, 422);
    assert.equal(await models.User.count(), 0);
    const result = await request('/farmers/register', {
      method: 'POST',
      body: { ...profile, ...verification, role: 'admin' },
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.user.role, 'farmer');
    assert.equal(result.data.user.phoneVerified, true);
    assert.equal(result.data.user.farmerProfile.nidLast4, '7890');
    for (const value of ['passwordHash', 'password_hash', profile.nid, verification.code])
      assert(!JSON.stringify(result.data).includes(value));
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /SameSite=Lax/);
    assert.match(result.cookie, /Path=\/api/);
    primaryCookie = cookiePair(result.cookie);
    primaryUser = result.data.user;
    const session = await models.AuthSession.findOne({ where: { userId: primaryUser.id } });
    assert.equal(session.tokenHash, tokenDigest(primaryCookie.split('=')[1]));
    const replay = await request('/farmers/register', {
      method: 'POST',
      body: { ...profile, ...verification },
    });
    assert.equal(replay.status, 400);
    assert.equal(await models.User.count(), 1);
  });

  test('session restoration and logout work; logged-out tokens cannot be reused', async () => {
    assert.equal((await request('/me')).data.user, null);
    assert.equal((await request('/me', { cookie: 'fieldbridge_session=forged' })).data.user, null);
    assert.equal((await request('/me', { cookie: primaryCookie })).data.user.id, primaryUser.id);
    assert.equal((await request('/logout', { method: 'POST', cookie: primaryCookie })).status, 200);
    assert.equal((await request('/me', { cookie: primaryCookie })).data.user, null);
  });

  test('phone, Bangla phone digits and email login work; wrong passwords fail', async () => {
    assert.equal(
      (
        await request('/login', {
          method: 'POST',
          body: { identifier: profile.phone, password: 'wrong' },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request('/login', {
          method: 'POST',
          body: { identifier: 'unknown@example.test', password: profile.password },
        })
      ).status,
      401,
    );
    for (const identifier of [profile.phone, '০১৯০০০০০০০১', 'FARMER@EXAMPLE.TEST']) {
      const result = await request('/login', {
        method: 'POST',
        body: { identifier, password: profile.password },
        cookie: primaryCookie,
      });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      const old = primaryCookie;
      primaryCookie = cookiePair(result.cookie);
      assert.equal((await request('/me', { cookie: old })).data.user, null);
    }
    const session = await models.AuthSession.findOne({
      where: { tokenHash: tokenDigest(primaryCookie.split('=')[1]) },
    });
    await session.update({ expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await request('/me', { cookie: primaryCookie })).data.user, null);
  });

  test('duplicate phone, email and NID are rejected without partial accounts', async () => {
    assert.equal(
      (await request('/farmers/otp', { method: 'POST', body: { phone: profile.phone } })).status,
      409,
    );
    const other = { ...profile, phone: '01900000002' };
    const verification = await otp(other.phone);
    const count = await models.User.count();
    const duplicateEmail = await request('/farmers/register', {
      method: 'POST',
      body: { ...other, ...verification, nid: '2234567890' },
    });
    assert.equal(duplicateEmail.status, 409);
    assert.equal(await models.User.count(), count);
    const duplicateNid = await request('/farmers/register', {
      method: 'POST',
      body: { ...other, ...verification, email: '' },
    });
    assert.equal(duplicateNid.status, 409);
    assert.equal(await models.User.count(), count);
    const fixed = await request('/farmers/register', {
      method: 'POST',
      body: { ...other, ...verification, nid: '2234567890', email: '' },
    });
    assert.equal(fixed.status, 201, JSON.stringify(fixed.data));
  });

  test('OTP failures persist, attempts are capped, and cooldown protects resend', async () => {
    const other = { ...profile, phone: '01900000003', nid: '3234567890', email: '' };
    const verification = await otp(other.phone);
    assert.equal(
      (await request('/farmers/otp', { method: 'POST', body: { phone: other.phone } })).status,
      429,
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await request('/farmers/register', {
            method: 'POST',
            body: { ...other, ...verification, code: '000000' },
          })
        ).status,
        422,
      );
    assert.equal((await models.PhoneVerification.findByPk(verification.challengeId)).attempts, 5);
    assert.equal(
      (await request('/farmers/register', { method: 'POST', body: { ...other, ...verification } }))
        .status,
      429,
    );
    await models.PhoneVerification.update(
      {
        nextSendAt: new Date(Date.now() - 1000),
        codeHash: otpDigest(verification.challengeId, '000000'),
      },
      { where: { id: verification.challengeId } },
    );
    const replacement = await otp(other.phone);
    assert.equal((await models.PhoneVerification.findByPk(verification.challengeId)).attempts, 0);
    assert.equal(
      (
        await request('/farmers/register', {
          method: 'POST',
          body: { ...other, ...replacement, code: '000000' },
        })
      ).status,
      422,
    );
    assert.equal(
      (await request('/farmers/register', { method: 'POST', body: { ...other, ...replacement } }))
        .status,
      201,
    );
  });

  test('expired and mismatched-phone OTPs cannot register accounts', async () => {
    const other = { ...profile, phone: '01900000004', nid: '4234567890', email: '' };
    const verification = await otp(other.phone);
    assert.equal(
      (
        await request('/farmers/register', {
          method: 'POST',
          body: { ...other, ...verification, phone: '01900000005' },
        })
      ).status,
      400,
    );
    await models.PhoneVerification.update(
      { expiresAt: new Date(Date.now() - 1000) },
      { where: { id: verification.challengeId } },
    );
    assert.equal(
      (await request('/farmers/register', { method: 'POST', body: { ...other, ...verification } }))
        .status,
      410,
    );
  });

  test('profile uploads reject fake images and safely re-encode real images', async () => {
    const other = { ...profile, phone: '01900000006', nid: '6234567890', email: '' };
    const verification = await otp(other.phone);
    const form = (file) => {
      const data = new FormData();
      for (const [key, value] of Object.entries({ ...other, ...verification }))
        data.append(key, value);
      data.append('photo', new Blob([file], { type: 'image/png' }), 'photo.png');
      return data;
    };
    assert.equal(
      (await request('/farmers/register', { method: 'POST', body: form('<script>bad</script>') }))
        .status,
      422,
    );
    assert.equal(
      (
        await request('/farmers/register', {
          method: 'POST',
          body: form(Buffer.alloc(2 * 1024 * 1024 + 1)),
        })
      ).status,
      422,
    );
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#456553' } })
      .png()
      .toBuffer();
    const result = await request('/farmers/register', { method: 'POST', body: form(png) });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.match(result.data.user.farmerProfile.photoUrl, /\.webp$/);
    const photoResponse = await fetch(new URL(result.data.user.farmerProfile.photoUrl, base));
    assert.equal(photoResponse.status, 200);
    assert.match(photoResponse.headers.get('content-type'), /image\/webp/);
  });

  test('untrusted origins are blocked and production cannot use console OTP', async () => {
    assert.equal(
      (
        await request('/login', {
          method: 'POST',
          body: { identifier: profile.phone, password: profile.password },
          origin: 'https://untrusted.example',
        })
      ).status,
      403,
    );
    const original = env.nodeEnv;
    try {
      env.nodeEnv = 'production';
      assert.equal(
        (await request('/farmers/otp', { method: 'POST', body: { phone: '01900000007' } })).status,
        503,
      );
      assert.equal(await models.PhoneVerification.count({ where: { phone: '01900000007' } }), 0);
    } finally {
      env.nodeEnv = original;
    }
  });

  let buyerCookie, buyerId, adminCookie;
  const buyer = {
    fullName: 'পরীক্ষার ক্রেতা',
    phone: '01900000040',
    password: 'Buyer!পরীক্ষা123',
    confirmPassword: 'Buyer!পরীক্ষা123',
    businessName: 'পরীক্ষার ব্যবসা',
    businessType: 'পাইকারি ব্যবসা',
    address: 'বগুড়া সদর, বগুড়া',
    email: 'buyer@example.test',
  };
  const admin = {
    ADMIN_NAME: 'পরীক্ষার অ্যাডমিন',
    ADMIN_PHONE: '01900000050',
    ADMIN_EMAIL: 'admin@example.test',
    ADMIN_PASSWORD: 'Admin!পরীক্ষা123',
  };

  async function adminCommand(overrides = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/create-admin.js'], {
        env: { ...process.env, ...admin, ...overrides },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, output }));
    });
  }

  test('buyer registration validates requirements and cannot self-approve or choose admin role', async () => {
    const invalid = await request('/buyers/register', {
      method: 'POST',
      body: { ...buyer, businessName: '', businessType: '', address: '' },
    });
    assert.equal(invalid.status, 422);
    assert(
      invalid.data.fields.businessName &&
        invalid.data.fields.businessType &&
        invalid.data.fields.address,
    );
    const result = await request('/buyers/register', {
      method: 'POST',
      body: { ...buyer, role: 'admin', status: 'approved' },
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.user.role, 'buyer');
    assert.equal(result.data.user.phoneVerified, false);
    assert.equal(result.data.user.buyerProfile.status, 'pending');
    assert(!JSON.stringify(result.data).includes('passwordHash'));
    buyerCookie = cookiePair(result.cookie);
    buyerId = result.data.user.id;
    assert.equal(
      (await request('/me', { cookie: buyerCookie })).data.user.buyerProfile.status,
      'pending',
    );
    assert.equal((await request('/buyers/register', { method: 'POST', body: buyer })).status, 409);
    assert.equal(
      (
        await request('/api/buyer/resubmit', {
          method: 'POST',
          cookie: buyerCookie,
          body: { ...buyer, version: 1 },
        })
      ).status,
      422,
    );
  });

  test('admin command requires explicit credentials, creates an admin and never overwrites accounts', async () => {
    assert.equal((await adminCommand({ ADMIN_PHONE: '', ADMIN_PASSWORD: '' })).code, 1);
    const first = await adminCommand();
    assert.equal(first.code, 0, first.output);
    assert(!first.output.includes(admin.ADMIN_PASSWORD));
    const row = await models.User.unscoped().findOne({ where: { phone: admin.ADMIN_PHONE } });
    assert.equal(row.role, 'admin');
    const stored = row.passwordHash;
    assert.equal((await adminCommand({ ADMIN_PASSWORD: 'Different!পরীক্ষা123' })).code, 0);
    await row.reload();
    assert.equal(row.passwordHash, stored);
    assert.equal((await adminCommand({ ADMIN_PHONE: profile.phone, ADMIN_EMAIL: '' })).code, 1);
    assert.equal((await models.User.findOne({ where: { phone: profile.phone } })).role, 'farmer');
    const loginResult = await request('/login', {
      method: 'POST',
      body: { identifier: admin.ADMIN_PHONE, password: admin.ADMIN_PASSWORD },
    });
    assert.equal(loginResult.status, 200);
    assert.equal(loginResult.data.user.role, 'admin');
    adminCookie = cookiePair(loginResult.cookie);
  });

  test('only admins can list or review buyers; application details contain no credentials', async () => {
    assert.equal((await request('/api/admin/buyers')).status, 401);
    assert.equal((await request('/api/admin/buyers', { cookie: buyerCookie })).status, 403);
    const farmerLogin = await request('/login', {
      method: 'POST',
      body: { identifier: profile.phone, password: profile.password },
    });
    assert.equal(
      (await request('/api/admin/buyers', { cookie: cookiePair(farmerLogin.cookie) })).status,
      403,
    );
    const list = await request('/api/admin/buyers', { cookie: adminCookie });
    assert.equal(list.status, 200);
    assert.equal(list.data.counts.pending, 1);
    const application = list.data.buyers[0];
    for (const key of [
      'fullName',
      'phone',
      'email',
      'businessName',
      'businessType',
      'address',
      'registeredAt',
    ])
      assert(application[key]);
    assert(!JSON.stringify(list.data).includes('passwordHash'));
    assert.equal(
      (
        await request(`/api/admin/buyers/${buyerId}/review`, {
          method: 'POST',
          cookie: buyerCookie,
          body: { decision: 'approved', version: 1 },
        })
      ).status,
      403,
    );
    assert.equal((await request('/api/admin/buyers?page=-1', { cookie: adminCookie })).status, 422);
  });

  test('rejection needs a reason; rejected buyers can fix and resubmit only their own application', async () => {
    const url = `/api/admin/buyers/${buyerId}/review`;
    assert.equal(
      (
        await request(url, {
          method: 'POST',
          cookie: adminCookie,
          body: { decision: 'rejected', version: 1, reason: '' },
        })
      ).status,
      422,
    );
    const reason = 'ব্যবসার ঠিকানাটি আরও বিস্তারিত লিখুন।';
    const rejected = await request(url, {
      method: 'POST',
      cookie: adminCookie,
      body: { decision: 'rejected', version: 1, reason },
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
    const me = (await request('/me', { cookie: buyerCookie })).data.user;
    assert.equal(me.buyerProfile.status, 'rejected');
    assert.equal(me.buyerProfile.rejectionReason, reason);
    const amended = {
      fullName: buyer.fullName,
      email: buyer.email,
      businessName: 'সংশোধিত ব্যবসা',
      businessType: buyer.businessType,
      address: 'মহাস্থান বাজার, শিবগঞ্জ, বগুড়া',
      version: 1,
    };
    assert.equal(
      (
        await request('/api/buyer/resubmit', {
          method: 'POST',
          cookie: buyerCookie,
          body: { ...amended, phone: '01900000999' },
        })
      ).status,
      422,
    );
    const resubmitted = await request('/api/buyer/resubmit', {
      method: 'POST',
      cookie: buyerCookie,
      body: amended,
    });
    assert.equal(resubmitted.status, 200, JSON.stringify(resubmitted.data));
    assert.equal(resubmitted.data.user.phone, buyer.phone);
    assert.equal(resubmitted.data.user.buyerProfile.status, 'pending');
    assert.equal(resubmitted.data.user.buyerProfile.rejectionReason, null);
    assert.equal(resubmitted.data.user.buyerProfile.version, 2);
    assert.equal(
      (
        await request(url, {
          method: 'POST',
          cookie: adminCookie,
          body: { decision: 'approved', version: 1 },
        })
      ).status,
      409,
    );
    const approved = await request(url, {
      method: 'POST',
      cookie: adminCookie,
      body: { decision: 'approved', version: 2 },
    });
    assert.equal(approved.status, 200);
    assert.equal(
      (await request('/me', { cookie: buyerCookie })).data.user.buyerProfile.status,
      'approved',
    );
    assert.equal(
      (
        await request(url, {
          method: 'POST',
          cookie: adminCookie,
          body: { decision: 'rejected', reason, version: 2 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request('/api/buyer/resubmit', {
          method: 'POST',
          cookie: buyerCookie,
          body: { ...amended, version: 2 },
        })
      ).status,
      409,
    );
    const approvedList = await request('/api/admin/buyers?status=approved', {
      cookie: adminCookie,
    });
    assert.equal(approvedList.data.counts.approved, 1);
    assert.equal(approvedList.data.buyers.length, 1);
  });

  test('buyer profile editing permits only name/email; optional email and buyer login work', async () => {
    assert.equal(
      (
        await request('/api/buyer/profile', {
          method: 'PATCH',
          cookie: buyerCookie,
          body: { fullName: buyer.fullName, email: buyer.email, businessName: 'চেষ্টা' },
        })
      ).status,
      422,
    );
    const updated = await request('/api/buyer/profile', {
      method: 'PATCH',
      cookie: buyerCookie,
      body: { fullName: 'সংশোধিত ক্রেতা', email: 'buyer-updated@example.test' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.user.buyerProfile.status, 'approved');
    const loginResult = await request('/login', {
      method: 'POST',
      body: { identifier: 'buyer-updated@example.test', password: buyer.password },
    });
    assert.equal(loginResult.status, 200);
    assert.equal(loginResult.data.user.role, 'buyer');
    const other = await request('/buyers/register', {
      method: 'POST',
      body: { ...buyer, phone: '01900000041', email: '' },
    });
    assert.equal(other.status, 201);
    assert.equal(other.data.user.email, null);
    assert.equal(other.data.user.buyerProfile.status, 'pending');
  });

  const crop = {
    cropName: 'পরীক্ষার আলু',
    quantity: '৫০০.১২৫',
    unit: 'kg',
    pricePerUnit: '২৫.৫০',
    harvestDate: '2026-11-20',
    availableDate: '2026-11-22',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    farmAddress: 'মহাস্থান, শিবগঞ্জ, বগুড়া',
    description: 'খামার থেকে সংগ্রহ করা পরীক্ষার আলু।',
  };
  let farmerCookie, secondFarmerCookie, cropListing, image;
  async function cropForm(values = crop, { images = [image], keep = [] } = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.append(key, String(value));
    form.append('retainedPhotos', JSON.stringify(keep));
    images.forEach((buffer) =>
      form.append('photos', new Blob([buffer], { type: 'image/png' }), 'crop.png'),
    );
    return form;
  }
  async function cropRequest(path = '', options = {}) {
    return request(`/api/farmer/listings${path}`, { cookie: farmerCookie, ...options });
  }

  test('crop listings require a verified farmer and cannot be used by buyers or admins', async () => {
    const farmer = await models.User.findByPk(primaryUser.id);
    farmerCookie = `fieldbridge_session=${(await newSession(farmer.id)).token}`;
    await farmer.update({ phoneVerifiedAt: null });
    assert.equal((await cropRequest()).status, 401);
    await farmer.update({ phoneVerifiedAt: new Date() });
    const second = await models.User.create({
      role: 'farmer',
      fullName: 'অন্য কৃষক',
      phone: '01900000088',
      passwordHash: (await models.User.unscoped().findByPk(farmer.id)).passwordHash,
      phoneVerifiedAt: new Date(),
    });
    await models.FarmerProfile.create({
      userId: second.id,
      nid: '9876543210',
      district: crop.district,
      upazila: crop.upazila,
      village: 'মহাস্থান',
      farmAddress: crop.farmAddress,
    });
    secondFarmerCookie = `fieldbridge_session=${(await newSession(second.id)).token}`;
    image = await sharp({ create: { width: 60, height: 40, channels: 3, background: '#8aa254' } })
      .png()
      .toBuffer();
    assert.equal((await cropRequest('', { cookie: undefined })).status, 401);
    assert.equal((await cropRequest('', { cookie: buyerCookie })).status, 403);
    assert.equal((await cropRequest('', { cookie: adminCookie })).status, 403);
    assert.equal(
      (
        await cropRequest('', {
          method: 'POST',
          origin: 'https://other.example',
          body: await cropForm(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await cropRequest('', { method: 'POST', cookie: buyerCookie, body: await cropForm() }))
        .status,
      403,
    );
    assert.equal((await cropRequest('?page=-1')).status, 422);
    assert.equal((await cropRequest('?status=unknown')).status, 422);
  });

  test('crop publication requires all fields and valid photographs; ownership and status cannot be injected', async () => {
    const invalid = await cropRequest('', { method: 'POST', body: await cropForm({}) });
    assert.equal(invalid.status, 422);
    assert(invalid.data.fields.harvestDate && invalid.data.fields.description);
    assert.equal(
      (await cropRequest('', { method: 'POST', body: await cropForm(crop, { images: [] }) }))
        .status,
      422,
    );
    assert.equal(
      (
        await cropRequest('', {
          method: 'POST',
          body: await cropForm({ ...crop, farmerId: primaryUser.id }),
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await cropRequest('', {
          method: 'POST',
          body: await cropForm({ ...crop, status: 'sold_out' }),
        })
      ).status,
      422,
    );
    const oldFiles = (await readdir(listingPhotoDirectory).catch(() => [])).sort();
    const forged = await cropRequest('', {
      method: 'POST',
      body: await cropForm(crop, { images: [image, Buffer.from('not an image')] }),
    });
    assert.equal(forged.status, 422);
    assert(forged.data.fields.photos);
    assert.deepEqual(
      (await readdir(listingPhotoDirectory)).sort(),
      oldFiles,
      'partial upload files must be cleaned',
    );
    assert.equal(
      (
        await cropRequest('', {
          method: 'POST',
          body: await cropForm(crop, { images: Array(6).fill(image) }),
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await cropRequest('', {
          method: 'POST',
          body: await cropForm(crop, { images: [Buffer.alloc(2 * 1024 * 1024 + 1)] }),
        })
      ).status,
      422,
    );
    const result = await cropRequest('', {
      method: 'POST',
      body: await cropForm(crop, { images: [image, image] }),
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    cropListing = result.data.listing;
    assert.equal(cropListing.status, 'active');
    assert.equal(cropListing.photos.length, 2);
    assert.equal(cropListing.quantity, '500.125');
    assert.equal(cropListing.pricePerUnit, '25.50');
    assert(!JSON.stringify(result.data).includes(primaryUser.id));
    for (const photo of cropListing.photos) {
      const response = await fetch(new URL(photo.url, base), {
        headers: { Cookie: farmerCookie, Origin: env.clientOrigin },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(
        (await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format,
        'webp',
      );
      assert.equal(
        (await fetch(new URL(photo.url, base), { headers: { Cookie: secondFarmerCookie } })).status,
        404,
      );
      assert.equal((await fetch(new URL(photo.url, base))).status, 401);
    }
  });

  test('farmers can list, edit and replace photos only on their own crops; old tabs cannot overwrite changes', async () => {
    const id = cropListing.id;
    const all = await cropRequest();
    assert.equal(all.data.total, 1);
    assert.equal(all.data.counts.active, 1);
    assert.equal((await cropRequest('', { cookie: secondFarmerCookie })).data.total, 0);
    assert.equal((await cropRequest(`/${id}`, { cookie: secondFarmerCookie })).status, 404);
    const updated = {
      ...crop,
      quantity: '৪০০.৫',
      pricePerUnit: '২৮.৭৫',
      version: cropListing.version,
    };
    const keep = [cropListing.photos[0].filename];
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'PUT',
          cookie: secondFarmerCookie,
          body: await cropForm(updated, { keep }),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await cropRequest(`/${id}/status`, {
          method: 'PATCH',
          cookie: secondFarmerCookie,
          body: { status: 'inactive', version: 1 },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'DELETE',
          cookie: secondFarmerCookie,
          body: { version: 1 },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'PUT',
          body: await cropForm(updated, { keep: ['c382327b-5682-4ab4-baf6-2d70ec977eb5.webp'] }),
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'PUT',
          body: await cropForm(updated, { images: [], keep: [] }),
        })
      ).status,
      422,
    );
    const removedFilename = cropListing.photos[1].filename;
    const result = await cropRequest(`/${id}`, {
      method: 'PUT',
      body: await cropForm(updated, { keep }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    cropListing = result.data.listing;
    assert.equal(cropListing.version, 2);
    assert.equal(cropListing.quantity, '400.5');
    assert.equal(cropListing.photos.length, 2);
    await assert.rejects(access(join(listingPhotoDirectory, removedFilename)));
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'PUT',
          body: await cropForm(updated, { images: [], keep }),
        })
      ).status,
      409,
    );
    assert.equal(
      (await cropRequest(`/${id}`, { method: 'DELETE', body: { version: 1 } })).status,
      409,
    );
    // Identical crop names remain valid for different harvests/prices.
    const duplicate = await cropRequest('', { method: 'POST', body: await cropForm(crop) });
    assert.equal(duplicate.status, 201);
    assert.equal((await cropRequest('', { cookie: secondFarmerCookie })).data.total, 0);
  });

  test('crop status transitions maintain stock; sold-out crops need new stock before reactivation, and deletion removes files', async () => {
    const id = cropListing.id;
    let result = await cropRequest(`/${id}/status`, {
      method: 'PATCH',
      body: { status: 'inactive', version: cropListing.version },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.listing.status, 'inactive');
    assert.equal((await cropRequest('?status=inactive')).data.total, 1);
    assert.equal(
      (
        await cropRequest(`/${id}/status`, {
          method: 'PATCH',
          body: { status: 'active', version: cropListing.version },
        })
      ).status,
      409,
    );
    result = await cropRequest(`/${id}/status`, {
      method: 'PATCH',
      body: { status: 'sold_out', version: result.data.listing.version },
    });
    assert.equal(result.status, 200);
    cropListing = result.data.listing;
    assert.equal(Number(cropListing.quantity), 0);
    assert.equal(
      (
        await cropRequest(`/${id}/status`, {
          method: 'PATCH',
          body: { status: 'active', version: cropListing.version },
        })
      ).status,
      422,
    );
    const keep = cropListing.photos.map((photo) => photo.filename);
    result = await cropRequest(`/${id}`, {
      method: 'PUT',
      body: await cropForm(
        { ...crop, quantity: '100', version: cropListing.version },
        { images: [], keep },
      ),
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.listing.status, 'sold_out');
    result = await cropRequest(`/${id}/status`, {
      method: 'PATCH',
      body: { status: 'active', version: result.data.listing.version },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.listing.status, 'active');
    assert.equal(
      (
        await cropRequest(`/${id}`, {
          method: 'DELETE',
          body: { version: result.data.listing.version },
        })
      ).status,
      200,
    );
    assert.equal((await cropRequest(`/${id}`)).status, 404);
    for (const filename of keep)
      await assert.rejects(access(join(listingPhotoDirectory, filename)));
  });

  test('listing pagination and status counts stay scoped to the farmer', async () => {
    for (let index = 0; index < 12; index++) {
      const result = await cropRequest('', { method: 'POST', body: await cropForm(crop) });
      assert.equal(result.status, 201, JSON.stringify(result.data));
    }
    const first = (await cropRequest('?page=1')).data;
    const second = (await cropRequest('?page=2')).data;
    assert.equal(first.total, 13);
    assert.equal(first.listings.length, 12);
    assert.equal(second.listings.length, 1);
    assert.equal(second.pages, 2);
    assert.equal(first.counts.active, 13);
    assert.equal(new Set([...first.listings, ...second.listings].map((row) => row.id)).size, 13);
    assert.equal((await cropRequest('', { cookie: secondFarmerCookie })).data.total, 0);
    assert.equal((await cropRequest('?status=inactive')).data.total, 0);
  });

  test('login requests are rate-limited', async () => {
    let last;
    for (let i = 0; i < 21; i++) last = await request('/login', { method: 'POST', body: {} });
    assert.equal(last.status, 429);
  });
}
