import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SupportedLocale } from './types';
import en from './locales/en';
import kn from './locales/kn';
import hi from './locales/hi';

const LOCALE_STORAGE_KEY = 'kamadhenu.selected_locale';
const INITIALIZED_STORAGE_KEY = 'kamadhenu.locale_initialized';

const webStore = {
  async getItemAsync(key: string) {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  },
  async setItemAsync(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

const DICTIONARIES = {
  en,
  kn,
  hi,
};

interface LanguageContextType {
  locale: SupportedLocale;
  isInitialized: boolean;
  setLocale: (newLocale: SupportedLocale) => Promise<void>;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  isInitialized: true,
  setLocale: async () => {},
  t: (key: string) => key,
});

export const useTranslation = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const [isInitialized, setIsInitialized] = useState<boolean>(true); // default true until check completes to prevent flash
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const savedLocale = await store.getItemAsync(LOCALE_STORAGE_KEY);
        const initialized = await store.getItemAsync(INITIALIZED_STORAGE_KEY);

        if (savedLocale === 'en' || savedLocale === 'kn' || savedLocale === 'hi') {
          setLocaleState(savedLocale);
        }

        if (initialized === 'true') {
          setIsInitialized(true);
        } else {
          // If no language has been chosen yet, flag as not initialized
          setIsInitialized(false);
        }
      } catch {
        // Fallback to English
        setLocaleState('en');
        setIsInitialized(true);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    setIsInitialized(true);
    try {
      await store.setItemAsync(LOCALE_STORAGE_KEY, newLocale);
      await store.setItemAsync(INITIALIZED_STORAGE_KEY, 'true');
    } catch {
      // ignore storage failure
    }
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
      const keys = path.split('.');

      let current: any = dict;
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          // Fallback to English if key is missing in active locale
          let fallback: any = DICTIONARIES.en;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = fallback[fbKey];
            } else {
              fallback = null;
              break;
            }
          }
          current = fallback ?? path;
          break;
        }
      }

      let result = typeof current === 'string' ? current : path;

      if (params) {
        for (const [paramKey, val] of Object.entries(params)) {
          result = result.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(val));
        }
      }

      return result;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, isInitialized, setLocale, t }),
    [locale, isInitialized, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export * from './types';
