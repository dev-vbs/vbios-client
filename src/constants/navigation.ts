import { IconUser, IconServer, IconCreditCard, IconReceipt, IconLayoutDashboard } from '@tabler/icons-react';

export const NAV_ITEMS = [
  { path: '/overview', labelKey: 'nav.overview', icon: IconLayoutDashboard },
  { path: '/', labelKey: 'nav.services', icon: IconServer },
  // { path: '/tickets', labelKey: 'nav.tickets', icon: IconMessages },
  { path: '/profile', labelKey: 'profile.title', icon: IconUser },
  { path: '/payments', labelKey: 'nav.payments', icon: IconCreditCard },
  { path: '/withdrawals', labelKey: 'nav.withdrawals', icon: IconReceipt },
] as const;
