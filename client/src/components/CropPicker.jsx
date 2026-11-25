import { useId } from 'react';
import FormField from './FormField.jsx';
import { cropCatalog, cropSelection, resolveCropName, searchCropCatalog } from '../../../shared/crop-catalog.js';

export function CropSuggestions({ id, query }) {
  return (
    <datalist id={id}>
      {searchCropCatalog(query).map(({ cropName, terms }) => (
        <option key={cropName} value={cropName} label={terms.slice(1).join(' · ')} />
      ))}
    </datalist>
  );
}

export default function CropPicker({ form, onChange, error, buyer, disabled, legacyName }) {
  const list = useId();
  const crop = cropCatalog.find((item) => item.id === form.cropId);
  function type(text) {
    const selected = resolveCropName(text);
    onChange({ cropName: text, cropId: selected?.cropId ?? '', varietyId: selected?.varietyId ?? '' });
  }
  function selectVariety(id) {
    const selected = cropSelection(crop.id, id || null);
    onChange({ ...selected, varietyId: id });
  }
  return (
    <>
      <FormField
        name="cropName" label="ফসলের নাম" value={form.cropName} list={list}
        onChange={(event) => type(event.target.value)}
        onBlur={() => { if (crop) selectVariety(form.varietyId); }}
        placeholder="বাংলা বা ইংরেজিতে খুঁজুন" autoComplete="off" maxLength={100}
        error={error} disabled={disabled}
        hint={legacyName && !form.cropId ? `পুরোনো নাম ‘${legacyName}’। তালিকা থেকে ফসলটি শনাক্ত করুন।` : undefined}
      />
      <CropSuggestions id={list} query={form.cropName} />
      {crop?.varieties.length > 0 && (
        <FormField
          name="varietyId" label="জাত" optional disabled={disabled} value={form.varietyId}
          onChange={(event) => selectVariety(event.target.value)}
          options={[
            { value: '', label: buyer ? 'যেকোনো জাত' : 'জাত উল্লেখ নেই' },
            ...crop.varieties.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
      )}
    </>
  );
}
