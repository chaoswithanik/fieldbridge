import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { env } from '../config/env.js';

export function defineModels(connection, prefix = '') {
  const common = { underscored: true, timestamps: true };
  const User = connection.define(
    'User',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      role: { type: DataTypes.ENUM('farmer', 'buyer', 'admin'), allowNull: false },
      fullName: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(11), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(254), allowNull: true, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      phoneVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      ...common,
      tableName: `${prefix}users`,
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
    },
  );

  const FarmerProfile = connection.define(
    'FarmerProfile',
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      nid: { type: DataTypes.STRING(17), allowNull: false, unique: true },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(80), allowNull: false },
      village: { type: DataTypes.STRING(100), allowNull: false },
      farmAddress: { type: DataTypes.STRING(500), allowNull: false },
      farmName: { type: DataTypes.STRING(120), allowNull: true },
      avatarFilename: { type: DataTypes.STRING(50), allowNull: true },
    },
    { ...common, tableName: `${prefix}farmer_profiles` },
  );

  const BuyerProfile = connection.define(
    'BuyerProfile',
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      businessName: { type: DataTypes.STRING(160), allowNull: false },
      businessType: { type: DataTypes.STRING(80), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      rejectionReason: { type: DataTypes.STRING(500), allowNull: true },
      submittedAt: { type: DataTypes.DATE, allowNull: false },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      reviewedBy: { type: DataTypes.UUID, allowNull: true },
      applicationVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    },
    {
      ...common,
      tableName: `${prefix}buyer_profiles`,
      indexes: [{ fields: ['status', 'submitted_at'] }],
    },
  );

  const PhoneVerification = connection.define(
    'PhoneVerification',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      phone: { type: DataTypes.STRING(11), allowNull: false, unique: true },
      codeHash: { type: DataTypes.STRING(64), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      nextSendAt: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { ...common, tableName: `${prefix}phone_verifications` },
  );

  const CropListing = connection.define(
    'CropListing',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      farmerId: { type: DataTypes.UUID, allowNull: false },
      cropName: { type: DataTypes.STRING(100), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      reservedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      unit: { type: DataTypes.ENUM('kg', 'ton', 'piece'), allowNull: false },
      pricePerUnit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      harvestDate: { type: DataTypes.DATEONLY, allowNull: false },
      availableDate: { type: DataTypes.DATEONLY, allowNull: false },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(80), allowNull: false },
      farmAddress: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: false },
      photoFilenames: { type: DataTypes.JSON, allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'sold_out'),
        allowNull: false,
        defaultValue: 'active',
      },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    },
    {
      ...common,
      tableName: `${prefix}crop_listings`,
      indexes: [{ fields: ['farmer_id', 'status', 'created_at'] }],
    },
  );

  const PurchaseRequirement = connection.define(
    'PurchaseRequirement',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      buyerId: { type: DataTypes.UUID, allowNull: false },
      cropName: { type: DataTypes.STRING(100), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      unit: { type: DataTypes.ENUM('kg', 'ton', 'piece'), allowNull: false },
      deliveryAddress: { type: DataTypes.STRING(500), allowNull: false },
      instructions: { type: DataTypes.STRING(2000), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'fulfilled'),
        allowNull: false,
        defaultValue: 'active',
      },
      editCount: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, max: 2 },
      },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    },
    {
      ...common,
      tableName: `${prefix}purchase_requirements`,
      indexes: [
        { fields: ['buyer_id', 'status', 'created_at'], name: 'requirement_buyer_status_created' },
      ],
    },
  );

  const Order = connection.define(
    'Order',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      buyerId: { type: DataTypes.UUID, allowNull: false },
      requirementId: { type: DataTypes.UUID, allowNull: true },
      requestId: { type: DataTypes.UUID, allowNull: false },
      requestHash: { type: DataTypes.STRING(64), allowNull: false },
      mode: { type: DataTypes.ENUM('individual', 'collective'), allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      totalQuantity: { type: DataTypes.DECIMAL(13, 3), allowNull: false },
      totalCost: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
    },
    {
      ...common,
      tableName: `${prefix}orders`,
      indexes: [{ unique: true, fields: ['buyer_id', 'request_id'], name: 'order_buyer_request' }],
    },
  );
  const OrderPortion = connection.define(
    'OrderPortion',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      orderId: { type: DataTypes.UUID, allowNull: false },
      farmerId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      quantity: { type: DataTypes.DECIMAL(13, 3), allowNull: false },
      totalCost: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      respondedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { ...common, tableName: `${prefix}order_portions` },
  );
  const OrderItem = connection.define(
    'OrderItem',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      portionId: { type: DataTypes.UUID, allowNull: false },
      listingId: { type: DataTypes.UUID, allowNull: true },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
    },
    { ...common, tableName: `${prefix}order_items` },
  );
  const Notification = connection.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      recipientId: { type: DataTypes.UUID, allowNull: false },
      orderId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      message: { type: DataTypes.STRING(1000), allowNull: false },
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    { ...common, tableName: `${prefix}notifications` },
  );

  const AuthSession = connection.define(
    'AuthSession',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    { ...common, tableName: `${prefix}auth_sessions`, indexes: [{ fields: ['expires_at'] }] },
  );

  User.hasOne(FarmerProfile, { foreignKey: 'userId', as: 'farmerProfile', onDelete: 'CASCADE' });
  FarmerProfile.belongsTo(User, { foreignKey: 'userId' });
  User.hasOne(BuyerProfile, { foreignKey: 'userId', as: 'buyerProfile', onDelete: 'CASCADE' });
  BuyerProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  BuyerProfile.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer', onDelete: 'SET NULL' });
  User.hasMany(AuthSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
  AuthSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  User.hasMany(CropListing, { foreignKey: 'farmerId', as: 'cropListings', onDelete: 'CASCADE' });
  CropListing.belongsTo(User, { foreignKey: 'farmerId', as: 'farmer' });
  User.hasMany(PurchaseRequirement, {
    foreignKey: 'buyerId',
    as: 'purchaseRequirements',
    onDelete: 'CASCADE',
  });
  PurchaseRequirement.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
  Order.belongsTo(User, { foreignKey: 'buyerId', onDelete: 'RESTRICT' });
  Order.belongsTo(PurchaseRequirement, { foreignKey: 'requirementId', onDelete: 'SET NULL' });
  Order.hasMany(OrderPortion, { foreignKey: 'orderId', as: 'portions' });
  OrderPortion.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  OrderPortion.belongsTo(User, { foreignKey: 'farmerId', onDelete: 'RESTRICT' });
  OrderPortion.hasMany(OrderItem, { foreignKey: 'portionId', as: 'items' });
  OrderItem.belongsTo(OrderPortion, { foreignKey: 'portionId' });
  OrderItem.belongsTo(CropListing, { foreignKey: 'listingId', onDelete: 'SET NULL' });
  Notification.belongsTo(User, { foreignKey: 'recipientId', onDelete: 'CASCADE' });
  Notification.belongsTo(Order, { foreignKey: 'orderId' });
  return {
    User,
    FarmerProfile,
    BuyerProfile,
    PhoneVerification,
    AuthSession,
    CropListing,
    PurchaseRequirement,
    Order,
    OrderPortion,
    OrderItem,
    Notification,
  };
}

export const models = sequelize ? defineModels(sequelize, env.database.tablePrefix) : null;
