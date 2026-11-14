import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

interface AppThemeValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    secondaryText: string;
    mutedText: string;
    border: string;
    input: string;
    primary: string;
    tabBar: string;
  };
}

const THEME_STORAGE_KEY = 'app-theme-mode';
const AppThemeContext = createContext<AppThemeValue | undefined>(undefined);

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export const AppThemeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let isMounted = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedMode) => {
        if (isMounted && isThemeMode(storedMode)) {
          setThemeModeState(storedMode);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load saved theme preference:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(
      (error: unknown) => {
        console.error('Could not save theme preference:', error);
      },
    );
  }, []);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const value = useMemo<AppThemeValue>(
    () => ({
      themeMode,
      setThemeMode,
      isDark,
      colors: {
        background: isDark ? '#0B1220' : '#F8FAFC',
        surface: isDark ? '#111B2E' : '#FFFFFF',
        surfaceMuted: isDark ? '#172338' : '#F1F5F9',
        text: isDark ? '#F3F4F6' : '#111827',
        secondaryText: isDark ? '#C0CAD8' : '#4B5563',
        mutedText: isDark ? '#9AA8BA' : '#6B7280',
        border: isDark ? '#29364A' : '#E5E7EB',
        input: isDark ? '#0F192B' : '#FFFFFF',
        primary: '#2563EB',
        tabBar: isDark ? '#111B2E' : '#FFFFFF',
      },
    }),
    [isDark, setThemeMode, themeMode],
  );

  return React.createElement(AppThemeContext.Provider, { value }, children);
};

export const useAppTheme = (): AppThemeValue => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }
  return context;
};
