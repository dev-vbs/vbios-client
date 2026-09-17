import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'violet',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 'sm',
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
    Button: {
      defaultProps: { radius: 'sm' },
    },
    Card: {
      defaultProps: { radius: 'sm', withBorder: true },
    },
    Paper: {
      defaultProps: { radius: 'sm', withBorder: true },
    },
    Modal: {
      defaultProps: {
        lockScroll: false,
      },
    },
  },
});
