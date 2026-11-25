import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { validateFarmerProfile } from '../lib/validation.js';
import { publicUser } from './auth.js';
import { prepareAvatar, saveAvatar, deleteAvatar } from './avatar.js';

export async function editFarmerProfile(userId, input, file) {
  const allowed = [
    'fullName', 'email', 'farmName', 'district', 'upazila', 'village', 'farmAddress', 'version',
  ];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !allowed.includes(key)) ||
      !/^[a-f0-9]{64}$/.test(input.version || ''))
    throw new AppError(422, 'প্রোফাইলের নির্ধারিত তথ্য দিয়ে আবার চেষ্টা করুন।');
  const avatarBuffer = await prepareAvatar(file);
  let addedPhoto;
  let oldPhoto;
  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const user = await models.User.findOne({
        where: { id: userId, role: 'farmer' }, transaction, lock: transaction.LOCK.UPDATE,
      });
      const profile = await models.FarmerProfile.findByPk(userId, {
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!user?.phoneVerifiedAt || !profile)
        throw new AppError(403, 'কৃষকের অ্যাকাউন্ট পাওয়া যায়নি।');
      user.farmerProfile = profile;
      if (publicUser(user).farmerProfile.version !== input.version)
        throw new AppError(409, 'প্রোফাইলের তথ্য বদলেছে। সর্বশেষ তথ্য এনে আবার সম্পাদনা করুন।');
      const { fullName, email, ...farm } = validateFarmerProfile(input, profile);
      oldPhoto = profile.avatarFilename;
      addedPhoto = await saveAvatar(avatarBuffer);
      await user.update({ fullName, email }, { transaction });
      await profile.update({
        ...farm, ...(addedPhoto ? { avatarFilename: addedPhoto } : {}),
      }, { transaction });
      return publicUser(user);
    });
  } catch (error) {
    await deleteAvatar(addedPhoto);
    throw error;
  }
  if (addedPhoto) await deleteAvatar(oldPhoto);
  return result;
}
