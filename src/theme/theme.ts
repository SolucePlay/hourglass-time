import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Palette inspirée de Material You (violet/indigo Hourglass-friendly).
// Sur Android 12+, on pourrait brancher les couleurs dynamiques du système
// avec un module natif dédié, mais ceci reste 100% compatible Expo Go.

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',
    secondary: '#625B71',
    secondaryContainer: '#E8DEF8',
    tertiary: '#4CAF93',
    onTertiary: '#FFFFFF',
    background: '#FFFBFE',
    surface: '#FFFBFE',
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    error: '#B3261E',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',
    secondary: '#CCC2DC',
    secondaryContainer: '#4A4458',
    tertiary: '#7FD8B8',
    onTertiary: '#00382A',
    background: '#1C1B1F',
    surface: '#1C1B1F',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    error: '#F2B8B5',
  },
};
