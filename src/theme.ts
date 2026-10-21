import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: 'lg',
  colors: {
    blue: ['#edf4ff', '#dce9ff', '#b9d1ff', '#8fb6ff', '#6699fa', '#3975ed', '#245dd1', '#1f4cad', '#193d89', '#142f69'],
    dark: ['#d6e0f5', '#b9c5dc', '#8f9db8', '#6e7c96', '#4d5b74', '#35425a', '#26334a', '#1a263b', '#121d30', '#0c1525'],
  },
  components: { Modal: { defaultProps: { lockScroll: false, radius: 'xl' } }, Button: { defaultProps: { radius: 'md' } } },
});
