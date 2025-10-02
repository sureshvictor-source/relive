export const AuroraTheme = {
  colors: {
    // Primary Aurora Colors
    primary: {
      50: '#f0f4ff',
      100: '#e0eaff',
      200: '#c7d7fe',
      300: '#a5b8fc',
      400: '#8b92f8',
      500: '#7366f0',
      600: '#6548e4',
      700: '#5a38d0',
      800: '#4c2fa8',
      900: '#412a85',
      950: '#2a1a51',
    },

    // Secondary Emerald
    secondary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },

    // Accent Amber
    accent: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },

    // Neutral Grays
    neutral: {
      0: '#ffffff',
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
    },

    // Semantic Colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    // Surface Colors
    background: '#fafafa',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',

    // Text Colors
    text: {
      primary: '#171717',
      secondary: '#525252',
      tertiary: '#a3a3a3',
      inverse: '#ffffff',
    },

    // Border & Divider
    border: '#e5e5e5',
    divider: '#f5f5f5',

    // Gradients
    gradients: {
      primary: ['#7366f0', '#5a38d0'],
      secondary: ['#10b981', '#047857'],
      aurora: ['#7366f0', '#10b981', '#f59e0b'],
      surface: ['#ffffff', '#fafafa'],
    },
  },

  typography: {
    fonts: {
      regular: 'System',
      medium: 'System',
      semiBold: 'System',
      bold: 'System',
    },

    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
    },

    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },

    weights: {
      normal: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
    '4xl': 96,
  },

  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 16,
    },
  },

  animations: {
    duration: {
      fast: 200,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
};

export type Theme = typeof AuroraTheme;