import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'violet',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 'lg',
  colors: {
    violet: ['#f4f0ff', '#e4dafe', '#c5b8fa', '#a692f4', '#8b72ef', '#795aec', '#704ded', '#5e3bda', '#5131c1', '#452ba2'],
    dark: [
      '#d8d7e0', '#b6b4c0', '#8e8b9c', '#686577', '#474457',
      '#302e3e', '#252332', '#1c1a29', '#15131f', '#0d0c14',
    ],
  },
  components: {
    Button: {
      defaultProps: { radius: 'lg' },
      styles: { root: { fontWeight: 600, letterSpacing: '-0.01em' } },
    },
    Card: {
      defaultProps: { radius: 'xl' },
    },
    Paper: {
      defaultProps: { radius: 'xl' },
    },
    Modal: {
      defaultProps: {
        lockScroll: false,
      },
    },
  },
});
