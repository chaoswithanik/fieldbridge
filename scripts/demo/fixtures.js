// The keys are local references used to connect listings, demands and order history.
export const farmers = [
  { key: 'farmer1', name: 'রহিম মিয়া', farm: 'তিস্তা ফসলঘর', district: 'রংপুর', upazila: 'গঙ্গাচড়া', village: 'লক্ষ্মীটারী' },
  { key: 'farmer2', name: 'শিউলি বেগম', farm: 'শিউলির সবজি বাগান', district: 'রংপুর', upazila: 'গঙ্গাচড়া', village: 'কোলকোন্দ' },
  { key: 'farmer3', name: 'সাইফুল ইসলাম', farm: 'সবুজ মাঠ', district: 'রংপুর', upazila: 'মিঠাপুকুর', village: 'পায়রাবন্দ' },
  { key: 'farmer4', name: 'মালতি রানী', farm: 'করতোয়া কৃষি খামার', district: 'বগুড়া', upazila: 'শিবগঞ্জ', village: 'মোকামতলা' },
  { key: 'farmer5', name: 'হাসান আলী', farm: 'পদ্মা কৃষি', district: 'রাজশাহী', upazila: 'পবা', village: 'হরিয়ান' },
];

export const buyers = [
  { key: 'buyer', name: 'নাসরিন আক্তার', business: 'নগর সবজি বাজার', type: 'খুচরা বাজার', address: '১২ বাজার সড়ক, কারওয়ান বাজার, ঢাকা', status: 'approved' },
  { key: 'wholesale', name: 'ইমরান হোসেন', business: 'উত্তরবঙ্গ আড়ত', type: 'পাইকারি আড়ত', address: '৮ আড়ত সড়ক, সাহেব বাজার, রাজশাহী', status: 'approved' },
  { key: 'pending', name: 'মিতা সাহা', business: 'মাঠের রান্নাঘর', type: 'রেস্তোরাঁ', address: '৫ কলেজ রোড, রংপুর সদর', status: 'pending' },
  { key: 'rejected', name: 'আনিস মণ্ডল', business: 'ফসল সংগ্রহ কেন্দ্র', type: 'সংগ্রহ কেন্দ্র', address: '২১ স্টেশন রোড, বগুড়া সদর', status: 'rejected' },
];

export const crops = {
  potato: 'আলু', tomato: 'টমেটো', carrot: 'গাজর', pumpkin: 'মিষ্টিকুমড়া',
  cucumber: 'শসা', radish: 'মূলা', corn: 'ভুট্টা',
};

function lot(key, farmer, crop, quantity, price, unit = 'kg', status = 'active') {
  return { key, farmer, crop, quantity, price, unit, status };
}

export const listings = [
  lot('potato-exact', 'farmer1', 'potato', 100, 29),
  lot('potato-spare', 'farmer2', 'potato', 112, 27),
  lot('tomato-60', 'farmer1', 'tomato', 60, 45),
  lot('tomato-40', 'farmer2', 'tomato', 40, 47),
  lot('tomato-45', 'farmer3', 'tomato', 45, 42),
  lot('carrot-20', 'farmer2', 'carrot', 20, 52),
  lot('carrot-30', 'farmer4', 'carrot', 30, 50),
  lot('carrot-50', 'farmer5', 'carrot', 50, 48),
  lot('pumpkin-22', 'farmer1', 'pumpkin', 22, 90, 'piece'),
  lot('pumpkin-38', 'farmer4', 'pumpkin', 38, 85, 'piece'),
  lot('pumpkin-39', 'farmer5', 'pumpkin', 39, 87, 'piece'),
  lot('cucumber-350', 'farmer3', 'cucumber', 0.35, 35000, 'ton'),
  lot('cucumber-450', 'farmer4', 'cucumber', 0.45, 34000, 'ton'),
  lot('radish-paused', 'farmer1', 'radish', 75, 22, 'kg', 'inactive'),
  lot('radish-sold', 'farmer5', 'radish', 0, 21, 'kg', 'sold_out'),
  lot('corn-main', 'farmer1', 'corn', 90, 12, 'piece'),
  lot('corn-35', 'farmer2', 'corn', 35, 11, 'piece'),
  lot('corn-25', 'farmer3', 'corn', 25, 13, 'piece'),
  lot('corn-backup', 'farmer4', 'corn', 65, 12, 'piece'),
];

function demand(key, crop, quantity, unit, instructions, buyer = 'buyer', status = 'active') {
  return { key, crop, quantity, unit, instructions, buyer, status };
}

export const demands = [
  demand('single', 'potato', 100, 'kg', '১০ কেজির বস্তায় আলু দিন। একজন কৃষকের কাছ থেকে পুরো চালান নিতে চাই।'),
  demand('pair', 'tomato', 100, 'kg', 'আলাদা কৃষকের টমেটো এক চালানে নেওয়া যাবে। কয়েক কেজি বেশি হলেও চলবে।'),
  demand('trio', 'carrot', 100, 'kg', 'তিন খামারের গাজর একসঙ্গে সংগ্রহের ব্যবস্থা আছে।'),
  demand('limit', 'pumpkin', 50, 'piece', '৫০টি কুমড়া প্রয়োজন। বাড়তি সর্বোচ্চ ১০টি রাখা যাবে।'),
  demand('short', 'cucumber', 1, 'ton', 'এক টন শসা প্রয়োজন। প্রথম চালানে আংশিক সরবরাহ নেওয়া যাবে।'),
  demand('none', 'radish', 70, 'kg', 'নতুন চালানের মূলা এলে যোগাযোগ করুন।'),
  demand('paused', 'radish', 45, 'kg', 'গুদাম খোলার পর সংগ্রহ শুরু হবে।', 'wholesale', 'inactive'),
  demand('awaiting', 'corn', 15, 'piece', 'পরের বাজারের জন্য ভুট্টা প্রয়োজন।'),
  demand('finished', 'corn', 50, 'piece', 'সকালের চালান আড়তে পৌঁছে দিন।', 'wholesale'),
  demand('split', 'corn', 60, 'piece', 'দুই খামার থেকে একসঙ্গে ভুট্টা সংগ্রহ করা হবে।'),
  demand('declined', 'corn', 10, 'piece', 'দশটি ভুট্টার একটি পরীক্ষামূলক চালান চাই।', 'wholesale'),
  demand('replacement', 'corn', 20, 'piece', 'প্রথম সরবরাহকারী না পারলে বিকল্প খামার থেকে নেব।'),
];
