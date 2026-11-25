import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { allUpazilas, districts, findPlace, searchPlaces } from '../../../shared/geography/index.js';
import './location-fields.css';

function PlaceSelect({ label, name, options, value, onSelect, optional, disabled, error, showDistrict }) {
  const id = useId();
  const trigger = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = searchPlaces(options, query);
  const choices = optional && !query ? [null, ...results] : results;
  const selected = findPlace(options, value);
  const placeholder = disabled ? 'আগে জেলা বেছে নিন' : optional ? `সব ${label}` : `${label} বেছে নিন`;

  function expand() {
    setQuery('');
    setActive(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(place) {
    onSelect(place);
    close();
  }
  function keyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(i + step, choices.length - 1)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (choices.length) choose(choices[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open, query]);

  return (
    <div className={`form-field location-field ${error ? 'has-error' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <label htmlFor={id} id={`${id}-label`}>
        {label} {!optional && <span className="required-mark" aria-label="আবশ্যক">*</span>}
      </label>
      <button type="button" id={id} ref={trigger} className="location-trigger" name={name}
        aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined} aria-haspopup="listbox"
        disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => open ? close() : expand()}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); expand(); } }}>
        <span id={`${id}-value`}>{selected?.bn || value || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="location-popup">
          <input autoFocus type="text" role="combobox" aria-label={`${label} খুঁজুন`}
            aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-list`}
            aria-activedescendant={choices.length ? `${id}-option-${active}` : undefined}
            placeholder="বাংলা বা ইংরেজিতে খুঁজুন" autoComplete="off" value={query}
            onKeyDown={keyDown} onChange={(event) => { setQuery(event.target.value); setActive(0); }} />
          <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
            {choices.map((place, i) => (
              <li key={place ? `${place.district || ''}/${place.en}` : 'all'}
                role="option" aria-selected={place ? place === selected : !value}
                id={`${id}-option-${i}`} className={active === i ? 'is-active' : undefined}
                onMouseDown={(event) => event.preventDefault()} onClick={() => choose(place)}>
                {place ? <>
                  <span>{place.bn}{showDistrict && ` · ${place.district}`}</span>
                  <small lang="en">{place.en}</small>
                </> : `সব ${label}`}
              </li>
            ))}
          </ul>
          {!choices.length && <p role="status">কোনো মিল পাওয়া যায়নি।</p>}
        </div>
      )}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export default function LocationFields({ values, onChange, errors = {}, optional = false }) {
  const district = findPlace(districts, values.district);
  return (
    <>
      <PlaceSelect label="জেলা" name="district" options={districts} value={values.district}
        optional={optional} error={errors.district}
        onSelect={(place) => onChange({
          district: place?.bn || '',
          upazila: place && place === district ? values.upazila : '',
        })} />
      <PlaceSelect label="উপজেলা" name="upazila" value={values.upazila}
        options={district?.upazilas ?? (optional ? allUpazilas : [])} showDistrict={!district}
        optional={optional} disabled={!optional && !district} error={errors.upazila}
        onSelect={(place) => onChange({ district: place?.district || values.district, upazila: place?.bn || '' })} />
    </>
  );
}
