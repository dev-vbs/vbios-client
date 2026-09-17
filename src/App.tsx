import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { useEffect, useState } from 'react';
import { MantineProvider, AppShell, Group, Text, ActionIcon, Button, Modal, TextInput, Stack, DirectionProvider, Indicator, Tooltip, Center, Loader, Box } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { useMediaQuery, useHotkeys, useLongPress } from '@mantine/hooks';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { IconLogout, IconHeadset, IconBell, IconBellOff, IconWallet, IconSearch } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useStore } from './store/useStore';
import { NAV_ITEMS } from './constants/navigation';
import { auth } from './api/client';
import { getCookie, removeCookie, parseAndSavePartnerId, parseAndSaveSessionId } from './api/cookie';
import { config } from './config';
import LanguageSwitcher from './components/LanguageSwitcher';
import { hasTelegramWebAppAutoAuth, isTelegramWebApp } from './constants/webapp';
import { useEmailRequired } from './hooks/useEmailRequired';
import { useTicketPoller } from './hooks/useTicketPoller';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useNotificationFromUrl } from './hooks/useNotificationFromUrl';
import PayHistoryModal from './components/PayHistoryModal';
import PayModal from './components/PayModal';
import WithdrawHistoryModal from './components/WithdrawHistoryModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { LegalLinks } from './components/LegalLinks';
import { ThemeToggle } from './components/ThemeToggle';
import { WebAppHeader } from './components/WebAppHeader';
import { BottomNavigation } from './components/BottomNavigation';
import { theme } from './theme';

parseAndSaveSessionId();
parseAndSavePartnerId();

import Services from './pages/Services';
import Profile from './pages/Profile';
import Tickets from './pages/Tickets.tsx';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import AddToHomeScreen from './pages/AddToHomeScreen';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasAddToHomeScreen = searchParams.has('addToHomeScreen');
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || !!(window.navigator as Navigator & { standalone?: boolean }).standalone;

  const { isAuthenticated, isLoading, setUser, setIsLoading, logout, userEmail, isEmailLoaded, setOpenEmailModal, user } = useStore();
  const emailBlocked = config.EMAIL_REQUIRED === 'true' && isEmailLoaded && !userEmail;
  const { isSupported, isSubscribed, isLoading: pushLoading, error: pushError, subscribe, unsubscribe } = usePushNotifications();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { t, i18n } = useTranslation();
  const {
    modalOpen: globalEmailModalOpen,
    setModalOpen: setGlobalEmailModalOpen,
    emailInput: globalEmailInput,
    setEmailInput: setGlobalEmailInput,
    saving: globalEmailSaving,
    handleSave: handleGlobalSaveEmail,
    isValidEmail,
    verifyModalOpen: globalVerifyModalOpen,
    setVerifyModalOpen: setGlobalVerifyModalOpen,
    verifyCode: globalVerifyCode,
    setVerifyCode: setGlobalVerifyCode,
    verifySending: globalVerifySending,
    verifyConfirming: globalVerifyConfirming,
    resendCooldown: globalResendCooldown,
    pendingEmail: globalPendingEmail,
    handleConfirmEmail: handleGlobalConfirmEmail,
    handleResendCode: handleGlobalResendCode,
  } = useEmailRequired();

  useNotificationFromUrl();
  // useTicketPoller(isAuthenticated);
  useTicketPoller(false); // TODO: включить когда бэкенд будет готов

  const [payHistoryOpen, setPayHistoryOpen] = useState(false);
  const [withdrawHistoryOpen, setWithdrawHistoryOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const showVersion = () => setVersionOpen(true);
  const longPressProps = useLongPress(showVersion);

  const handleSupportLink = () => {
    if (config.SUPPORT_LINK) {
      const tgWebApp = window.Telegram?.WebApp;
      if (tgWebApp && isTelegramWebApp && config.SUPPORT_LINK.includes('t.me')) {
        tgWebApp.openTelegramLink(config.SUPPORT_LINK);
      } else {
        window.open(config.SUPPORT_LINK, '_blank');
      }
    }
  };

  useEffect(() => {
    const tgWebApp = window.Telegram?.WebApp;
    if (tgWebApp && isTelegramWebApp) {
      tgWebApp.ready();
      tgWebApp.expand();
      if (tgWebApp.setHeaderColor) tgWebApp.setHeaderColor('secondary_bg_color');
      if (tgWebApp.setBackgroundColor) tgWebApp.setBackgroundColor('secondary_bg_color');
    }
  }, [isTelegramWebApp]);

  useEffect(() => {
    const tgWebApp = window.Telegram?.WebApp;
    if (!tgWebApp || !isTelegramWebApp) return;
    const backButton = tgWebApp.BackButton;
    if (!backButton) return;
    const isMainPage = location.pathname === '/' || location.pathname === '';
    if (isMainPage) {
      backButton.hide();
    } else {
      backButton.show();
      backButton.onClick(() => { navigate('/'); });
    }
    return () => {
      backButton.hide();
      backButton.offClick(() => {});
    };
  }, [location.pathname, navigate, isTelegramWebApp]);

  useEffect(() => {
    if (hasAddToHomeScreen) { setIsLoading(false); return; }
    const checkAuth = async () => {
      const token = getCookie();
      if (!token) { setIsLoading(false); return; }
      try {
        const response = await auth.getCurrentUser();
        const responseData = response.data.data;
        const userData: any = Array.isArray(responseData) ? responseData[0] : responseData;
        setUser(userData);
      } catch {
        removeCookie();
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [setUser, setIsLoading, hasAddToHomeScreen]);

  useEffect(() => {
    if (!config.SUPPORT_WIDGET_URL || !user) return;
    const existing = document.getElementById('__support_widget__');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = '__support_widget__';
    script.src = config.SUPPORT_WIDGET_URL;
    script.async = true;
    script.dataset.api = config.SUPPORT_WIDGET_API || '';
    script.dataset.userId = String(user.user_id);
    script.dataset.colorPrimary = '#1971c2';
    script.dataset.lang = i18n.language === 'ru' ? 'ru' : 'en';
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, [user?.user_id]);

  useHotkeys([['shift + V', () => setVersionOpen(true)]]);

  if (hasAddToHomeScreen) {
    if (isPWA) return <Navigate to="/" replace />;
    return <AddToHomeScreen />;
  }

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box style={{ flex: 1 }}>
          <Login />
          <LegalLinks />
        </Box>
      </Box>
    );
  }

  const emailRequiredModal = (
    <Modal
      opened={globalEmailModalOpen}
      onClose={() => setGlobalEmailModalOpen(false)}
      title={t('profile.linkEmail')}
      closeOnClickOutside
      closeOnEscape
      withCloseButton
    >
      <Stack gap="md">
        <TextInput
          label={t('profile.emailAddress')}
          placeholder="example@email.com"
          withAsterisk
          error={globalEmailInput.length > 0 && !isValidEmail(globalEmailInput)}
          type="email"
          value={globalEmailInput}
          onChange={(e) => setGlobalEmailInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGlobalSaveEmail()}
        />
        <Text size="xs" c="dimmed">{t('profile.emailHint')}</Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setGlobalEmailModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleGlobalSaveEmail} loading={globalEmailSaving} disabled={!isValidEmail(globalEmailInput)}>{t('common.save')}</Button>
        </Group>
      </Stack>
    </Modal>
  );

  const verifyRequiredModal = (
    <Modal
      opened={globalVerifyModalOpen}
      onClose={() => setGlobalVerifyModalOpen(false)}
      title={t('profile.verifyEmail')}
    >
      <Stack gap="md">
        <Text size="sm">{t('profile.verifyEmailDescription', { email: globalPendingEmail })}</Text>
        <TextInput
          label={t('profile.verifyCode')}
          placeholder="123456"
          value={globalVerifyCode}
          onChange={(e) => setGlobalVerifyCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGlobalConfirmEmail()}
          maxLength={6}
        />
        <Group justify="space-between">
          <Button
            variant="subtle"
            size="xs"
            onClick={handleGlobalResendCode}
            loading={globalVerifySending}
            disabled={globalResendCooldown > 0}
          >
            {globalResendCooldown > 0 ? `${t('profile.resendCode')} (${globalResendCooldown}s)` : t('profile.resendCode')}
          </Button>
          <Group gap="xs">
            <Button variant="light" onClick={() => setGlobalVerifyModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleGlobalConfirmEmail} loading={globalVerifyConfirming} disabled={!globalVerifyCode.trim()}>
              {t('profile.confirmEmail')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );

  const versionModal = (
    <Modal opened={versionOpen} onClose={() => setVersionOpen(false)} title="Version" size="xs" centered>
      <Text size="sm" ff="monospace" ta="center" py="xs">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'}</Text>
    </Modal>
  );

  if (isTelegramWebApp || isMobile) {
    return (
      <>
        {emailRequiredModal}
        {verifyRequiredModal}
        {versionModal}
        <Box style={{ minHeight: '100vh', paddingBottom: 150 }}>
          <WebAppHeader />
          <Box px="md">
            <Routes>
              <Route path="/" element={<Services />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Box>
          <LegalLinks />
          <BottomNavigation onPayments={() => setPayHistoryOpen(true)} onWithdrawals={() => setWithdrawHistoryOpen(true)} />
        </Box>
        <PayHistoryModal opened={payHistoryOpen} onClose={() => setPayHistoryOpen(false)} />
        <WithdrawHistoryModal opened={withdrawHistoryOpen} onClose={() => setWithdrawHistoryOpen(false)} />
        <PWAInstallBanner />
      </>
    );
  }

  const hasLegalLinks = [config.PRIVACY_POLICY_URL, config.TERMS_OF_USE_URL, config.PUBLIC_OFFER_URL, config.USER_AGREEMENT_URL, config.CONTACT_EMAIL, config.CONTACT_PHONE].some(Boolean);

  return (
    <>
      {emailRequiredModal}
      {verifyRequiredModal}
      {versionModal}
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: 'sm' }}
        footer={hasLegalLinks ? { height: 'auto' } : undefined}
        padding="md"
        className="laravel-shell"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} {...longPressProps}>
              <Box className="laravel-logo" w={32} h={32}>S</Box>
              <Text size="lg" fw={700} visibleFrom="sm">
                {config.APP_NAME}
              </Text>
            </Group>
            <TextInput className="laravel-search" visibleFrom="sm" placeholder="Поиск по услугам..." leftSection={<IconSearch size={16} />} rightSection={<Text size="xs" c="dimmed">Ctrl K</Text>} />
            <Group>
              {user && (
                <Button
                  leftSection={<IconWallet size={16} />}
                  variant="light"
                  color="cyan"
                  size="xs"
                  onClick={() => setPayModalOpen(true)}
                >
                  {user.balance} {t('common.currency')}
                </Button>
              )}
              {isSupported && (
                <Tooltip
                  label={isSubscribed ? t('profile.pushDisableHint') : t('profile.pushEnableHint')}
                  position="bottom"
                  withArrow
                >
                  <Indicator color="green" size={8} disabled={isSubscribed} offset={4}>
                    <ActionIcon
                      onClick={async () => {
                        if (isSubscribed) {
                          const ok = await unsubscribe();
                          if (ok) notifications.show({ message: t('profile.pushDisabled'), color: 'gray' });
                        } else {
                          const ok = await subscribe();
                          if (ok) notifications.show({ message: t('profile.pushEnabled'), color: 'green' });
                          else if (pushError) notifications.show({ message: pushError, color: 'red' });
                        }
                      }}
                      variant={isSubscribed ? 'default' : 'light'}
                      color={isSubscribed ? undefined : 'green'}
                      size="lg"
                      loading={pushLoading}
                      aria-label="Push notifications"
                    >
                      {isSubscribed ? <IconBellOff size={16} /> : <IconBell size={16} />}
                    </ActionIcon>
                  </Indicator>
                </Tooltip>
              )}
              {config.SUPPORT_LINK && (
                <ActionIcon onClick={handleSupportLink} variant="subtle" size="lg" color="blue">
                  <IconHeadset size={20} />
                </ActionIcon>
              )}
              <LanguageSwitcher />
              <ThemeToggle />
              {!hasTelegramWebAppAutoAuth && (
                <ActionIcon onClick={logout} variant="default" size="lg" aria-label="Logout">
                  <IconLogout size={18} />
                </ActionIcon>
              )}
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="sm">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm" pt="sm" pb={8}>Обзор</Text>
          <Stack gap={4}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              const action = item.path === '/payments' ? () => emailBlocked ? setOpenEmailModal(true) : setPayHistoryOpen(true) : item.path === '/withdrawals' ? () => emailBlocked ? setOpenEmailModal(true) : setWithdrawHistoryOpen(true) : undefined;
              const buttonProps = { justify: 'flex-start' as const, leftSection: <Icon size={18} stroke={1.7} />, variant: 'subtle' as const, className: 'laravel-nav-link', 'data-active': active, fullWidth: true };
              return action
                ? <Button key={item.path} {...buttonProps} onClick={action}>{t(item.labelKey)}</Button>
                : <Button key={item.path} {...buttonProps} component={Link} to={item.path}>{t(item.labelKey)}</Button>;
            })}
          </Stack>
          <Box mt="auto" p="sm" style={{ borderTop: '1px solid #202424' }}>
            <Text size="sm" fw={700}>{user?.full_name || user?.login || 'Профиль'}</Text>
            <Text size="xs" c="dimmed">{user?.balance || '0'} {t('common.currency')}</Text>
          </Box>
        </AppShell.Navbar>
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<Services />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell.Main>
        <AppShell.Footer withBorder={false}>
          <LegalLinks />
        </AppShell.Footer>
      </AppShell>
      <PayHistoryModal opened={payHistoryOpen} onClose={() => setPayHistoryOpen(false)} />
      <WithdrawHistoryModal opened={withdrawHistoryOpen} onClose={() => setWithdrawHistoryOpen(false)} />
      <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} />
      <PWAInstallBanner />
    </>
  );
}

function App() {
  const basePath = config.SHM_BASE_PATH && config.SHM_BASE_PATH !== '/' ? config.SHM_BASE_PATH : undefined;
  const { i18n } = useTranslation();

  useEffect(() => {
    if (config.BITRIX_WIDGET_SCRIPT_URL) {
      const script = document.createElement('script');
      script.async = true;
      script.src = config.BITRIX_WIDGET_SCRIPT_URL + '?' + (Date.now() / 60000 | 0);
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(script, firstScript);
      return () => { script.remove(); };
    }
  }, []);

  const isRtl = i18n.language === 'ar';

  return (
    <DirectionProvider initialDirection={isRtl ? 'rtl' : 'ltr'}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <BrowserRouter basename={basePath}>
          <AppContent />
        </BrowserRouter>
      </MantineProvider>
    </DirectionProvider>
  );
}

export default App;
