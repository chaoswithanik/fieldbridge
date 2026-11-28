export const progressStages = ['accepted', 'preparing', 'ready_for_collection', 'collected', 'completed'];

export const progressLabels = {
  accepted: 'গৃহীত',
  preparing: 'প্রস্তুতি চলছে',
  ready_for_collection: 'সংগ্রহের জন্য প্রস্তুত',
  collected: 'সংগ্রহ করা হয়েছে',
  completed: 'এই অংশের কাজ সম্পন্ন',
};

export const progressActions = {
  preparing: 'প্রস্তুতি শুরু করুন',
  ready_for_collection: 'সংগ্রহের জন্য প্রস্তুত চিহ্নিত করুন',
  collected: 'সংগ্রহ করা হয়েছে চিহ্নিত করুন',
  completed: 'নিজের অংশ সম্পন্ন করুন',
};

export function nextProgressStage(stage) {
  const index = progressStages.indexOf(stage);
  return index < 0 ? undefined : progressStages[index + 1];
}
