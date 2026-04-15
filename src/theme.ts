import { createTheme, rem } from '@mantine/core';

/**
 * Legacy (pre-redesign) theme. Used when THEME_GLASSMORPHISM_ENABLE !== 'true'.
 * Kept byte-compatible with the prior inline theme in App.tsx.
 */
export const legacyTheme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#25262b',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
  },
  components: {
    Modal: {
      defaultProps: {
        lockScroll: false,
      },
    },
  },
});

/**
 * Glassmorphism dark theme. Tokens mirror `:root[data-mantine-color-scheme="dark"]`
 * custom properties declared in index.css. Activated by THEME_GLASSMORPHISM_ENABLE === 'true'.
 */
export const glassTheme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'lg',
  radius: {
    xs: rem(8),
    sm: rem(12),
    md: rem(14),
    lg: rem(20),
    xl: rem(999),
  },
  colors: {
    violet: [
      '#F1ECFF',
      '#D9CBFF',
      '#B9A3FF',
      '#9E82FF',
      '#8A6BFF',
      '#6A4BFF',
      '#5B3DF5',
      '#4F35D6',
      '#3E27B0',
      '#2D1C85',
    ],
    dark: [
      '#E6E6EE',
      '#C9C9D4',
      '#9A9AA8',
      '#70707F',
      '#4B4B56',
      '#2E2E38',
      '#1A1A24',
      '#111119',
      '#0B0B14',
      '#07070D',
    ],
  },
  other: {
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.06)',
    glassRaised: 'rgba(255,255,255,0.07)',
    blurBg: 'blur(20px) saturate(140%)',
    gradBalance: 'linear-gradient(135deg,#5B3DF5 0%,#8A6BFF 55%,#B9A3FF 100%)',
    gradCTA: 'linear-gradient(90deg,#6A4BFF 0%,#3E8BFF 100%)',
  },
  components: {
    Modal: {
      defaultProps: { lockScroll: false, radius: 'lg' },
      classNames: { content: 'shm-glass', overlay: 'shm-modal-overlay' },
    },
    Card: {
      defaultProps: { radius: 'lg' },
      classNames: { root: 'shm-glass' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
      classNames: { root: 'shm-glass' },
    },
    Button: { defaultProps: { radius: 'md' } },
  },
});
