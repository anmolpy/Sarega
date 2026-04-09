/**
 * Settings Context — stores Gemini API key and app preferences
 * Persists to localStorage
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface Settings {
  geminiApiKey: string;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
}

const STORAGE_KEY = 'tracknotes-settings';

const defaults: Settings = {
  geminiApiKey: '',
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaults,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
