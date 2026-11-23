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
  return {
    User,
    FarmerProfile,
    BuyerProfile,
    PhoneVerification,
    AuthSession,
    CropListing,
    PurchaseRequirement,
  };
}

export const models = sequelize ? defineModels(sequelize, env.database.tablePrefix) : null;
