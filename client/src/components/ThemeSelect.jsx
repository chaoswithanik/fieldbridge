import { useEffect, useState } from 'react';
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';

const storageKey = 'fieldbridge-theme';
const themes = {
  system: { label: 'ডিভাইস অনুযায়ী', icon: Monitor },
  light: { label: 'লাইট মোড', icon: Sun },
  dark: { label: 'ডার্ক মোড', icon: Moon },
};
const preference = (value) => value === 'light' || value === 'dark' ? value : 'system';

export default function ThemeSelect() {
  const [theme, setTheme] = useState(() => preference(document.documentElement.dataset.theme));

  useEffect(() => {
    function sync(event) {
      if (event.key === storageKey || event.key === null) setTheme(preference(event.newValue));
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // The browser picks the matching media tag when following the device.
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      const dark = theme === 'dark' || (theme === 'system' && meta.media.includes('dark'));
      meta.content = dark ? '#101713' : '#032517';
    }
  }, [theme]);

  function change(event) {
    const value = event.target.value;
    setTheme(value);
    try {
      if (value === 'system') localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
    } catch {
      // This tab still honors the choice when browser storage is unavailable.
    }
  }

  const Icon = themes[theme].icon;
  return (
    <label className="theme-select" title={`থিম: ${themes[theme].label}`}>
      <Icon size={19} aria-hidden="true" />
      <ChevronDown size={12} aria-hidden="true" />
      <select aria-label="থিম নির্বাচন করুন" value={theme} onChange={change}>
        {Object.entries(themes).map(([value, { label }]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}
