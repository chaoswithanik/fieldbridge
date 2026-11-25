import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { sequelize } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { migrationRunner } from '../../src/config/migrations.js';
import { hashPassword } from '../../src/lib/crypto.js';
import { models } from '../../src/models/index.js';
import { saveListingPhotos, deleteListingPhotos } from '../../src/services/listing-photos.js';
import { saveBuyerDocuments, deleteBuyerDocuments } from '../../src/services/buyer-documents.js';
import { placeOrder, previewOrder, respondToOrder } from '../../src/services/orders.js';
import { confirmReplacement, previewReplacement } from '../../src/services/replacements.js';
import { farmers, buyers, crops, listings, demands } from './fixtures.js';

const adminId = 'fbde0000-0000-4000-8000-000000000001';
const email = (key) => `${key}@fieldbridge.example`;
const phone = (index) => `0170009${String(index).padStart(4, '0')}`;
const uploads = new URL('../../uploads/', import.meta.url);
const passwordFile = new URL('demo-login.txt', uploads);

async function demoPassword() {
  await mkdir(uploads, { recursive: true });
  try {
    await writeFile(passwordFile, randomBytes(18).toString('base64url') + '\n', {
      flag: 'wx', mode: 0o600,
    });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const password = (await readFile(passwordFile, 'utf8')).trim();
  if (password.length < 12) throw new Error('uploads/demo-login.txt needs a password of at least 12 characters.');
  return password;
}

async function createAccounts(transaction, admin, password, files) {
  const farms = new Map();
  const businesses = new Map();
  const submittedAt = new Date(Date.now() - 2 * 86400000);
  for (const [i, farmer] of farmers.entries()) {
    const user = await models.User.create({
      role: 'farmer', fullName: farmer.name, email: email(farmer.key), phone: phone(11 + i),
      passwordHash: await hashPassword(password), phoneVerifiedAt: submittedAt,
    }, { transaction });
    const profile = await models.FarmerProfile.create({
      userId: user.id, nid: String(9900000011 + i), farmName: farmer.farm,
      district: farmer.district, upazila: farmer.upazila, village: farmer.village,
      farmAddress: [farmer.farm, farmer.village, farmer.upazila, farmer.district].join(', '),
    }, { transaction });
    farms.set(farmer.key, profile);
  }
  for (const [i, buyer] of buyers.entries()) {
    const user = await models.User.create({
      role: 'buyer', fullName: buyer.name, phone: phone(21 + i), email: email(buyer.key),
      passwordHash: await hashPassword(password),
    }, { transaction });
    const reviewed = buyer.status !== 'pending';
    const profile = await models.BuyerProfile.create({
      userId: user.id, businessName: buyer.business, businessType: buyer.type,
      address: buyer.address, status: buyer.status, submittedAt,
      reviewedBy: reviewed ? admin.id : null, reviewedAt: reviewed ? new Date() : null,
      rejectionReason: buyer.status === 'rejected' ? 'ব্যবসার ঠিকানাসহ হালনাগাদ নথি জমা দিন।' : null,
    }, { transaction });
    businesses.set(buyer.key, profile);
    const sample = Buffer.from(`<svg width="780" height="240" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f5f4e9"/>
      <g font-family="sans-serif" fill="#193d2d" x="36">
        <text x="36" y="60" font-size="30">FieldBridge demo application</text>
        <text x="36" y="115" font-size="24">Trade license sample for ${email(buyer.key)}</text>
        <text x="36" y="180" font-size="20">Fictional document for application review practice.</text>
      </g></svg>`);
    const [document] = await saveBuyerDocuments([{
      contentType: 'image/webp', documentType: 'trade_license',
      buffer: await sharp(sample).webp().toBuffer(),
    }]);
    files.documents.push(document.filename);
    await models.BuyerDocument.create({
      ...document, buyerId: user.id, applicationVersion: 1,
    }, { transaction });
  }
  return { farms, businesses };
}

async function createInventory(transaction, farms, files) {
  const rows = new Map();
  const today = new Date();
  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' });
  const day = (offset) => dateFormat.format(new Date(today.getTime() + offset * 86400000));
  for (const [i, lot] of listings.entries()) {
    const farm = farms.get(lot.farmer);
    const buffer = await readFile(new URL(`crops/${lot.crop}.webp`, import.meta.url));
    // Each listing owns its upload so a farmer can safely edit or delete the photos.
    const photoFilenames = await saveListingPhotos([{ buffer }]);
    files.photos.push(...photoFilenames);
    const row = await models.CropListing.create({
      farmerId: farm.userId, cropName: crops[lot.crop], quantity: lot.quantity, unit: lot.unit,
      pricePerUnit: lot.price, status: lot.status, photoFilenames,
      harvestDate: day(-(i % 4)), availableDate: day(i % 3),
      district: farm.district, upazila: farm.upazila, farmAddress: farm.farmAddress,
      description: `${farm.farm} থেকে বাছাই করা ${crops[lot.crop]}। সংগ্রহের আগে সময় জানিয়ে দিন।`,
    }, { transaction });
    rows.set(lot.key, row);
  }
  return rows;
}

async function createDemands(transaction, businesses) {
  const rows = new Map();
  for (const demand of demands) {
    const business = businesses.get(demand.buyer);
    const row = await models.PurchaseRequirement.create({
      buyerId: business.userId, cropName: crops[demand.crop], quantity: demand.quantity,
      unit: demand.unit, deliveryAddress: business.address, instructions: demand.instructions,
      status: demand.status,
    }, { transaction });
    rows.set(demand.key, row);
  }
  return rows;
}

async function createOrders(transaction, inventory, requirements) {
  async function order(key, lots) {
    const { id, buyerId } = requirements.get(key);
    const listingIds = lots.map((lot) => inventory.get(lot).id);
    const { quoteToken } = await previewOrder(buyerId, { requirementId: id, listingIds }, transaction);
    return (await placeOrder(buyerId, { quoteToken, requestId: randomUUID() }, transaction)).order;
  }
  async function respond(order, lot, decision) {
    const listing = inventory.get(lot);
    const portion = order.portions.find((p) => p.items.some((item) => item.listingId === listing.id));
    await respondToOrder(listing.farmerId, portion.id, { decision, version: portion.version }, transaction);
  }

  await order('awaiting', ['corn-main']);
  const finished = await order('finished', ['corn-main']);
  await respond(finished, 'corn-main', 'accepted');
  await requirements.get('finished').update({ status: 'fulfilled', version: 2 }, { transaction });
  await models.Notification.update({ readAt: new Date() }, { where: { orderId: finished.id }, transaction });

  const split = await order('split', ['corn-35', 'corn-25']);
  await respond(split, 'corn-35', 'accepted');
  await respond(split, 'corn-25', 'rejected');
  const declined = await order('declined', ['corn-25']);
  await respond(declined, 'corn-25', 'rejected');

  const replaced = await order('replacement', ['corn-25']);
  await respond(replaced, 'corn-25', 'rejected');
  const { buyerId } = requirements.get('replacement');
  const { quoteToken } = await previewReplacement(buyerId, replaced.id, {
    listingIds: [inventory.get('corn-backup').id],
  }, transaction);
  await confirmReplacement(buyerId, replaced.id, { quoteToken, requestId: randomUUID() }, transaction);
}

async function seed() {
  if (env.nodeEnv === 'production') throw new Error('Run the demo against a development database.');
  if (!sequelize) throw new Error('Configure MySQL in .env before running the demo.');
  await migrationRunner(sequelize).up();
  const files = { photos: [], documents: [] };
  try {
    return await sequelize.transaction(async (transaction) => {
      // The fixed admin ID is committed in the same transaction as the entire demo.
      if (await models.User.findByPk(adminId, { transaction })) return false;
      const password = await demoPassword();
      const admin = await models.User.create({
        id: adminId, role: 'admin', fullName: 'ডেমো প্রশাসক', email: email('admin'),
        phone: phone(1), passwordHash: await hashPassword(password),
      }, { transaction });
      const { farms, businesses } = await createAccounts(transaction, admin, password, files);
      const inventory = await createInventory(transaction, farms, files);
      const requirements = await createDemands(transaction, businesses);
      await createOrders(transaction, inventory, requirements);
      return true;
    });
  } catch (error) {
    await Promise.all([deleteListingPhotos(files.photos), deleteBuyerDocuments(files.documents)]);
    throw error;
  }
}

try {
  const created = await seed();
  console.log(created
    ? `Created 1 admin, ${farmers.length} farmers, ${buyers.length} buyers, ${listings.length} listings, ${demands.length} demands and 5 orders.`
    : 'Demo already installed. Your demo activity has been preserved.');
  console.log('Login emails (@fieldbridge.example): admin, farmer1–farmer5, buyer, wholesale, pending, rejected.');
  console.log('Shared local password: uploads/demo-login.txt');
  console.log('Start with buyer@fieldbridge.example at /requirements to explore crop matches.');
} catch (error) {
  console.error('Demo setup failed.', error.name === 'SequelizeUniqueConstraintError'
    ? 'A demo identity is already in use. Existing accounts were preserved.'
    : error.message);
  process.exitCode = 1;
} finally {
  await sequelize?.close();
}
