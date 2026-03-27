import { useEffect, useRef, useState } from 'react';
import { 
  Card, Text, Stack, Button, ActionIcon, TextInput, PasswordInput, 
  Divider, Title, Center, Modal, Group, Loader, useMantineColorScheme, 
  useComputedColorScheme, Paper, Tooltip, Box, Badge, 
  ThemeIcon, Transition, ScrollArea, Container, Flex, 
  RingProgress, SimpleGrid
} from '@mantine/core';
import { useForm, isEmail, hasLength } from '@mantine/form';
import { 
  IconLogin, IconUserPlus, IconHeadset, IconFingerprint, 
  IconShieldLock, IconBrandTelegram, IconMailForward, IconLock, 
  IconMoon, IconSun, IconServer, IconCopy, IconCheck,
  IconEye, IconEyeOff, IconRefresh, IconQrcode, IconCircleCheck, 
  IconX, IconClock, IconAlertCircle, IconRocket, IconWifi, 
  IconNetwork, IconPlugConnected
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { auth, passkeyApi, userApi } from '../api/client';
import { setCookie, getResetTokenCookie, removeResetTokenCookie, parseAndSaveResetToken } from '../api/cookie';
import { useStore } from '../store/useStore';
import TelegramLoginButton, { TelegramUser } from '../components/TelegramLoginButton';
import { config } from '../config';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { hasTelegramWebAppAutoAuth, hasTelegramWidget, hasTelegramWebAppAuth } from '../constants/webapp';
import { QRCodeSVG } from 'qrcode.react';
import { useClipboard } from '@mantine/hooks';

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <ActionIcon
      onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
      variant="default"
      size="lg"
      radius="xl"
      aria-label="Toggle color scheme"
    >
      {computedColorScheme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
    </ActionIcon>
  );
}

interface MTProxyConfig {
  enabled: boolean;
  ip: string;
  port: string;
  secret: string;
  link: string;
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [loginOrEmail, setLoginOrEmail] = useState('');
  const requireEmailRegister = config.EMAIL_REQUIRED === 'true';
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPasswordData, setNewPasswordData] = useState({ password: '', confirmPassword: '' });
  const [verifyingToken, setVerifyingToken] = useState(false);
  const { setUser, setTelegramPhoto } = useStore();
  const { t } = useTranslation();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const clipboard = useClipboard({ timeout: 1000 });
  
  // MTProxy state
  const [mtProxy, setMtProxy] = useState<MTProxyConfig>({
    enabled: false,
    ip: '',
    port: '',
    secret: '',
    link: ''
  });
  const [mtProxyModalOpen, setMtProxyModalOpen] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingValue, setPingValue] = useState<string>('-- ms');
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Load MTProxy config
  useEffect(() => {
    try {
      const windowConfig = (window as any).__APP_CONFIG__;
      const source = windowConfig || config;
      setMtProxy({
        enabled: source.MT_PROXY_ENABLED === 'true',
        ip: source.MT_PROXY_IP || '',
        port: source.MT_PROXY_PORT || '',
        secret: source.MT_PROXY_SECRET || '',
        link: source.MT_PROXY_LINK || ''
      });
    } catch (error) {
      console.error('Failed to load MTProxy config:', error);
    }
  }, []);

  // Check proxy ping with history
  const checkProxyPing = async () => {
    if (!mtProxy.enabled || !mtProxy.ip || !mtProxy.port) return;
    
    setPingLoading(true);
    setPingValue('...');
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const url = `https://${mtProxy.ip}:${mtProxy.port}`;
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      }).catch(() => {});
      
      clearTimeout(timeoutId);
      const pingTime = Date.now() - startTime;
      
      if (pingTime < 5000) {
        setPingValue(`${pingTime} ms`);
        setPingHistory(prev => [...prev.slice(-4), pingTime]);
      } else {
        setPingValue('таймаут');
      }
    } catch (error) {
      setPingValue('ошибка');
    } finally {
      setPingLoading(false);
    }
  };

  // Get ping status with quality indicator
  const getPingStatus = () => {
    if (pingValue === '-- ms' || pingValue === '...') {
      return { color: 'gray', text: 'Не проверено', icon: IconClock, quality: 0 };
    }
    if (pingValue === 'таймаут') {
      return { color: 'red', text: 'Таймаут', icon: IconX, quality: 0 };
    }
    if (pingValue === 'ошибка') {
      return { color: 'red', text: 'Ошибка', icon: IconAlertCircle, quality: 0 };
    }
    
    const ms = parseInt(pingValue);
    if (ms < 100) return { color: 'green', text: 'Отлично', icon: IconCircleCheck, quality: 100 };
    if (ms < 300) return { color: 'teal', text: 'Хорошо', icon: IconRocket, quality: 75 };
    if (ms < 800) return { color: 'orange', text: 'Средне', icon: IconClock, quality: 50 };
    return { color: 'red', text: 'Медленно', icon: IconAlertCircle, quality: 25 };
  };

  useEffect(() => {
    if (mtProxy.enabled && mtProxy.ip && mtProxy.port) {
      checkProxyPing();
      const interval = setInterval(checkProxyPing, 30000);
      return () => clearInterval(interval);
    }
  }, [mtProxy.enabled, mtProxy.ip, mtProxy.port]);

  const connectionString = mtProxy.link || `tg://proxy?server=${mtProxy.ip}&port=${mtProxy.port}&secret=${mtProxy.secret}`;
  const pingStatus = getPingStatus();

  const form = useForm({
    mode: 'controlled',
    validateInputOnBlur: true,
    initialValues: { login: '', password: '', confirmPassword: '' },
    validate: {
      login: (value) => {
        if (requireEmailRegister && modeRef.current === 'register') {
          return isEmail(t('auth.invalidEmail'))(value);
        }
        return null;
      },
      password: (value) => {
        if (modeRef.current !== 'register') return null;
        return hasLength({ min: 6 }, t('auth.passwordTooShort'))(value);
      },
      confirmPassword: (value, values) => {
        if (modeRef.current !== 'register') return null;
        return value === values.password ? null : t('auth.passwordsMismatch');
      },
    },
  });
  
  const isWebAuthnSupported = !!window.PublicKeyCredential;
  const { telegramWebApp } = useTelegramWebApp();
  const autoAuthTriggeredRef = useRef(false);
  const autoAuthAttemptKey = 'tg_webapp_auto_auth_attempted';
  const autoAuthCooldownMs = 60 * 1000;

  const fetchCaptcha = async () => {
    try {
      const res = await auth.getCaptcha();
      const raw = res.data?.data;
      setCaptcha(Array.isArray(raw) ? raw[0] : raw);
      setCaptchaAnswer('');
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (mode === 'register' && config.CAPTCHA_ENABLED === 'true') {
      void fetchCaptcha();
    } else {
      setCaptcha(null);
      setCaptchaAnswer('');
    }
  }, [mode]);

  useEffect(() => {
    if (!hasTelegramWebAppAutoAuth || autoAuthTriggeredRef.current || !telegramWebApp?.initData) {
      return;
    }

    const lastAttempt = Number(sessionStorage.getItem(autoAuthAttemptKey) || 0);
    if (lastAttempt && Date.now() - lastAttempt < autoAuthCooldownMs) {
      return;
    }

    autoAuthTriggeredRef.current = true;
    sessionStorage.setItem(autoAuthAttemptKey, String(Date.now()));
    setShowLoginForm(false);
    void handleTelegramWebAppAuth();
  }, [hasTelegramWebAppAutoAuth, telegramWebApp?.initData]);

  useEffect(() => {
    const checkResetToken = async () => {
      const urlToken = parseAndSaveResetToken();
      const token = urlToken || getResetTokenCookie();

      if (!token) return;

      setVerifyingToken(true);
      setResetToken(token);

      try {
        const response = await userApi.verifyResetToken(token);
        const msg = response.data?.data?.[0]?.msg || response.data?.data?.msg;

        if (msg === 'Successful') {
          setShowNewPasswordForm(true);
        } else {
          notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
          removeResetTokenCookie();
          setResetToken(null);
        }
      } catch {
        notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
        removeResetTokenCookie();
        setResetToken(null);
      } finally {
        setVerifyingToken(false);
      }
    };

    checkResetToken();
  }, []);

  const handleNewPasswordSubmit = async () => {
    if (!newPasswordData.password || !newPasswordData.confirmPassword) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }

    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      notifications.show({ title: t('common.error'), message: t('auth.passwordsMismatch'), color: 'red' });
      return;
    }

    if (!resetToken) {
      notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
      return;
    }

    setResetLoading(true);
    try {
      const response = await userApi.resetPasswordWithToken(resetToken, newPasswordData.password);
      const msg = response.data?.data?.[0]?.msg || response.data?.data?.msg;

      if (msg === 'Password reset successful') {
        notifications.show({ title: t('common.success'), message: t('auth.passwordResetSuccess'), color: 'green' });
      } else {
        notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
      }
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.invalidResetToken'), color: 'red' });
    } finally {
      removeResetTokenCookie();
      setResetToken(null);
      setShowNewPasswordForm(false);
      setNewPasswordData({ password: '', confirmPassword: '' });
      setResetLoading(false);
    }
  };

  const handleLogin = async (otpTokenParam?: string) => {
    if (!form.values.login || !form.values.password) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }

    setLoading(true);
    try {
      const result = await auth.login(form.values.login, form.values.password, otpTokenParam);

      if (result.otpRequired) {
        setShowOtp(true);
        setLoading(false);
        return;
      }

      const userResponse = await auth.getCurrentUser();
      const responseData = userResponse.data.data;
      const userData = Array.isArray(responseData) ? responseData[0] : responseData;
      setUser(userData);
      setShowOtp(false);
      setOtpToken('');
      notifications.show({ title: t('common.success'), message: t('auth.loginSuccess'), color: 'green' });
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 403 && axiosError.response?.data?.error?.includes('Password authentication is disabled')) {
        notifications.show({ title: t('common.error'), message: t('auth.passwordAuthDisabled'), color: 'red' });
      } else {
        notifications.show({ title: t('common.error'), message: t('auth.loginError'), color: 'red' });
      }
      setOtpToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpToken) {
      notifications.show({ title: t('common.error'), message: t('otp.enterValidCode'), color: 'red' });
      return;
    }
    await handleLogin(otpToken);
  };

  const handleRegister = async () => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    const { login, password } = form.values;
    if (!login || !password) {
      notifications.show({ title: t('common.error'), message: t('auth.fillAllFields'), color: 'red' });
      return;
    }

    if (config.CAPTCHA_ENABLED === 'true' && (!captcha || !captchaAnswer.trim())) {
      notifications.show({ title: t('common.error'), message: t('auth.captchaRequired'), color: 'red' });
      return;
    }

    setLoading(true);
    try {
      await auth.register(login, password, captcha?.token, captchaAnswer || undefined);
      notifications.show({ title: t('common.success'), message: t('auth.registerSuccess'), color: 'green' });
      setMode('login');
      form.setValues({ confirmPassword: '' });
      setCaptchaAnswer('');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const errMsg = axiosError.response?.data?.error || '';
      if (errMsg === 'Invalid captcha') {
        notifications.show({ title: t('common.error'), message: t('auth.captchaInvalid'), color: 'red' });
      } else if (errMsg === 'Captcha required') {
        notifications.show({ title: t('common.error'), message: t('auth.captchaRequired'), color: 'red' });
      } else {
        notifications.show({ title: t('common.error'), message: t('auth.registerError'), color: 'red' });
      }
      if (config.CAPTCHA_ENABLED === 'true') void fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  const handleTelegramWidgetAuth = async (telegramUser: TelegramUser) => {
    setLoading(true);
    try {
      await auth.telegramWidgetAuth(telegramUser);
      const userResponse = await auth.getCurrentUser();
      const responseData = userResponse.data.data;
      const userData = Array.isArray(responseData) ? responseData[0] : responseData;
      setUser(userData);

      if (telegramUser.photo_url) {
        setTelegramPhoto(telegramUser.photo_url);
      }

      notifications.show({ title: t('common.success'), message: t('auth.telegramAuth'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramWebAppAuth = async () => {
    if (!telegramWebApp?.initData) {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
      setShowLoginForm(true);
      return;
    }

    setLoading(true);
    try {
      const profile = config.TELEGRAM_WEBAPP_PROFILE || '';
      const authResponse = await auth.telegramWebAppAuth(telegramWebApp.initData, profile);
      const sessionId = authResponse.data?.session_id || authResponse.data?.id;
      if (!sessionId) {
        notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
        setShowLoginForm(true);
        return;
      }

      const userResponse = await auth.getCurrentUser();
      const responseData = userResponse.data.data;
      const userData = Array.isArray(responseData) ? responseData[0] : responseData;
      setUser(userData);

      if (telegramWebApp.initDataUnsafe?.user?.photo_url) {
        setTelegramPhoto(telegramWebApp.initDataUnsafe.user.photo_url);
      }

      notifications.show({ title: t('common.success'), message: t('auth.telegramAuth'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.telegramAuthError'), color: 'red' });
      setShowLoginForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginOrEmail) {
      notifications.show({ title: t('common.error'), message: t('auth.resetEnterLogin'), color: 'red' });
      return;
    }

    setResetLoading(true);
    try {
      const loginResponse = await userApi.resetPassword({ login: loginOrEmail });
      const loginMsg = loginResponse.data?.data?.[0]?.msg || loginResponse.data?.data?.msg;
      if (loginMsg === 'Successful') {
        notifications.show({ title: t('common.success'), message: t('auth.resetSuccess'), color: 'green' });
        setShowResetPassword(false);
        setResetLoading(false);
        return;
      }

      const emailResponse = await userApi.resetPassword({ email: loginOrEmail });
      const emailMsg = emailResponse.data?.data?.[0]?.msg || emailResponse.data?.data?.msg;
      if (emailMsg === 'Successful') {
        notifications.show({ title: t('common.success'), message: t('auth.resetSuccess'), color: 'green' });
        setShowResetPassword(false);
        setResetLoading(false);
        return;
      }

      notifications.show({ title: t('common.error'), message: t('auth.resetNotFound'), color: 'red' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('auth.resetNotFound'), color: 'red' });
    }
    setResetLoading(false);
  };

  const handlePasskeyAuth = async () => {
    if (!isWebAuthnSupported) {
      notifications.show({ title: t('common.error'), message: t('passkey.notSupported'), color: 'red' });
      return;
    }

    setPasskeyLoading(true);
    try {
      const optionsResponse = await passkeyApi.authOptionsPublic();
      const optionsData = optionsResponse.data.data;
      const options = Array.isArray(optionsData) ? optionsData[0] : optionsData;
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToArrayBuffer(options.challenge),
        timeout: options.timeout,
        rpId: options.rpId,
        userVerification: options.userVerification as UserVerificationRequirement,
      };
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to get credential');
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      const authResponse = await passkeyApi.authPublic({
        credential_id: arrayBufferToBase64Url(credential.rawId),
        rawId: arrayBufferToBase64Url(credential.rawId),
        response: {
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
          signature: arrayBufferToBase64Url(response.signature),
          userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : undefined,
        },
      });
      const authData = authResponse.data.data;
      const sessionData = Array.isArray(authData) ? authData[0] : authData;
      if (sessionData?.id) {
        setCookie(sessionData.id);
      }

      const userResponse = await auth.getCurrentUser();
      const responseData = userResponse.data.data;
      const userData = Array.isArray(responseData) ? responseData[0] : responseData;
      setUser(userData);

      notifications.show({ title: t('common.success'), message: t('auth.loginSuccess'), color: 'green' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('passkey.authError'), color: 'red' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSupportLink = () => {
    if (config.SUPPORT_LINK) {
      window.open(config.SUPPORT_LINK, '_blank');
    }
  };

  const avgPing = pingHistory.length > 0 
    ? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length) 
    : 0;

  return (
    <Box style={{ minHeight: '100vh', background: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-0)' }}>
      <Container size="xs" py={80}>
        {/* Main Login Card */}
        <Card 
          withBorder 
          radius="xl" 
          p="xl" 
          style={{
            background: isDark ? 'var(--mantine-color-dark-6)' : 'white',
            transition: 'all 0.3s ease',
            boxShadow: 'var(--mantine-shadow-lg)'
          }}
        >
          <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between" align="center">
              <ThemeToggle />
              <Group gap="xs" align="center">
                {config.LOGO_URL ? (
                  <img
                    src={config.LOGO_URL}
                    alt=""
                    style={{ height: 36, width: 36, objectFit: 'contain' }}
                  />
                ) : (
                  <ThemeIcon size={40} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                    <IconNetwork size={22} />
                  </ThemeIcon>
                )}
                <Title order={1} size="h2" c="blue.6">
                  {config.APP_NAME}
                </Title>
              </Group>
              <LanguageSwitcher />
            </Group>
            
            {config.APP_DESCRIPTION && (
              <Text size="sm" c="dimmed" ta="center">{config.APP_DESCRIPTION}</Text>
            )}
            
            <Divider />
            
            <Text fw={600} ta="center" size="lg">
              {mode === 'login' ? 'Добро пожаловать!' : 'Создать аккаунт'}
            </Text>

            {/* Telegram Auth Options */}
            {hasTelegramWebAppAuth && !showLoginForm && (
              <>
                <Button
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  leftSection={<IconBrandTelegram size={20} />}
                  onClick={handleTelegramWebAppAuth}
                  fullWidth
                  loading={loading}
                  radius="xl"
                  size="lg"
                >
                  {t('auth.loginWithTelegram')}
                </Button>

                <Divider label={t('common.or')} labelPosition="center" />

                <Button
                  variant="light"
                  onClick={() => setShowLoginForm(true)}
                  fullWidth
                  radius="xl"
                  size="md"
                >
                  {t('auth.useLoginPassword')}
                </Button>
              </>
            )}

            {hasTelegramWidget && (
              <>
                <Center>
                  <TelegramLoginButton
                    botName={config.TELEGRAM_BOT_NAME}
                    onAuth={handleTelegramWidgetAuth}
                    buttonSize="large"
                    requestAccess="write"
                  />
                </Center>

                <Divider label={t('common.or')} labelPosition="center" />
              </>
            )}

            {/* Login/Register Form */}
            {(!hasTelegramWebAppAuth || showLoginForm) && (
              <>
                <form onSubmit={handleSubmit}>
                  <Stack gap="md">
                    <TextInput
                      label={mode === 'register' && requireEmailRegister ? t('auth.emailLabel') : t('auth.loginLabel')}
                      placeholder={mode === 'register' && requireEmailRegister ? t('auth.emailPlaceholder') : t('auth.loginPlaceholder')}
                      autoComplete={mode === 'register' && requireEmailRegister ? 'email' : 'username'}
                      radius="md"
                      size="md"
                      leftSection={mode === 'register' && requireEmailRegister ? <IconMailForward size={18} /> : <IconUserPlus size={18} />}
                      {...form.getInputProps('login')}
                    />
                    
                    <PasswordInput
                      label={t('auth.passwordLabel')}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      radius="md"
                      size="md"
                      leftSection={<IconLock size={18} />}
                      {...form.getInputProps('password')}
                    />
                    
                    {mode === 'register' && (
                      <PasswordInput
                        label={t('auth.confirmPasswordLabel')}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        autoComplete="new-password"
                        radius="md"
                        size="md"
                        leftSection={<IconLock size={18} />}
                        {...form.getInputProps('confirmPassword')}
                      />
                    )}
                    
                    {mode === 'register' && config.CAPTCHA_ENABLED === 'true' && captcha && (
                      <Group gap="xs" align="flex-end">
                        <TextInput
                          style={{ flex: 1 }}
                          label={t('auth.captchaLabel')}
                          description={`${captcha.question} = ?`}
                          placeholder={t('auth.captchaPlaceholder')}
                          value={captchaAnswer}
                          onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
                          radius="md"
                          size="md"
                        />
                        <ActionIcon variant="light" size="lg" onClick={fetchCaptcha} title={t('auth.captchaRefresh')} radius="md">
                          <IconRefresh size={18} />
                        </ActionIcon>
                      </Group>
                    )}
                    
                    <Button
                      type="submit"
                      leftSection={mode === 'login' ? <IconLogin size={18} /> : <IconUserPlus size={18} />}
                      loading={loading}
                      radius="xl"
                      size="lg"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'violet' }}
                      fullWidth
                    >
                      {mode === 'login' ? t('auth.login') : t('auth.register')}
                    </Button>
                    
                    {mode === 'login' && isWebAuthnSupported && config.PASSKEY_AUTH_DISABLED === 'false' && (
                      <Button
                        variant="light"
                        leftSection={<IconFingerprint size={18} />}
                        loading={passkeyLoading}
                        onClick={handlePasskeyAuth}
                        radius="xl"
                        size="md"
                      >
                        {t('passkey.loginWithPasskey')}
                      </Button>
                    )}
                  </Stack>
                </form>

                <Flex gap="xs" justify="center" wrap="wrap">
                  {mode === 'login' ? (
                    <>
                      <Text size="sm" c="dimmed">{t('auth.noAccount')}</Text>
                      <Text 
                        component="span" 
                        c="blue"
                        style={{ cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => { setMode('register'); form.clearErrors(); }}
                      >
                        {t('auth.register')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text size="sm" c="dimmed">{t('auth.hasAccount')}</Text>
                      <Text 
                        component="span" 
                        c="blue"
                        style={{ cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => { setMode('login'); form.clearErrors(); }}
                      >
                        {t('auth.login')}
                      </Text>
                    </>
                  )}
                </Flex>

                {mode === 'login' && (
                  <Text size="sm" ta="center">
                    <Text 
                      component="span" 
                      c="blue" 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => setShowResetPassword(true)}
                    >
                      {t('auth.forgotPassword')}
                    </Text>
                  </Text>
                )}

                {hasTelegramWebAppAuth && showLoginForm && (
                  <>
                    <Divider label={t('common.or')} labelPosition="center" />
                    <Button
                      variant="outline"
                      color="blue"
                      leftSection={<IconBrandTelegram size={18} />}
                      onClick={handleTelegramWebAppAuth}
                      fullWidth
                      loading={loading}
                      radius="xl"
                    >
                      {t('auth.loginWithTelegram')}
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        </Card>

        {/* Floating MTProxy Button */}
        {mtProxy.enabled && mtProxy.ip && mtProxy.port && mtProxy.secret && (
          <Transition mounted={true} transition="slide-up" duration={400}>
            {(styles) => (
              <Button
                onClick={() => setMtProxyModalOpen(true)}
                style={{ ...styles, position: 'fixed', bottom: 24, left: 24 }}
                leftSection={<IconPlugConnected size={18} />}
                radius="xl"
                size="md"
                variant="light"
                color="blue"
              >
                Прокси для TELEGRAM
                <Badge size="xs" color={pingStatus.color} ml={8} circle />
              </Button>
            )}
          </Transition>
        )}
      </Container>

      {/* MTProxy Modal - Enhanced Design */}
      <Modal
        opened={mtProxyModalOpen}
        onClose={() => setMtProxyModalOpen(false)}
        title={
          <Group gap="sm">
            <ThemeIcon size={32} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
              <IconServer size={18} />
            </ThemeIcon>
            <Text fw={700} size="xl" c="blue.6">
              Телеграм прокси Подключение
            </Text>
          </Group>
        }
        size="lg"
        centered
        radius="xl"
        padding="xl"
        overlayProps={{ blur: 3 }}
      >
        <ScrollArea h={550}>
          <Stack gap="lg">
            {/* Status Card with Ring Progress */}
            <Paper 
              withBorder 
              p="xl" 
              radius="xl" 
              style={{
                background: `linear-gradient(135deg, ${isDark ? 'var(--mantine-color-dark-7)' : 'white'}, ${pingStatus.color === 'green' ? 'rgba(34, 197, 94, 0.05)' : pingStatus.color === 'red' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)'})`
              }}
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
                <Group gap="lg">
                  <RingProgress
                    size={100}
                    thickness={8}
                    roundCaps
                    sections={[{ value: pingStatus.quality, color: pingStatus.color }]}
                    label={
                      <Center>
                        <pingStatus.icon size={32} color={`var(--mantine-color-${pingStatus.color}-6)`} />
                      </Center>
                    }
                  />
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Статус соединения</Text>
                    <Text fw={800} size="28px" c={pingStatus.color}>
                      {pingStatus.text}
                    </Text>
                    <Group gap="xs" mt={4}>
                      <Badge color={pingStatus.color} variant="light" radius="xl">
                        Пинг: {pingValue}
                      </Badge>
                      {avgPing > 0 && (
                        <Badge variant="light" radius="xl">
                          Средний: {avgPing} ms
                        </Badge>
                      )}
                    </Group>
                  </div>
                </Group>
                
                <Group justify="flex-end" align="flex-start">
                  <Tooltip label="Проверить задержку">
                    <ActionIcon 
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'violet' }}
                      onClick={checkProxyPing}
                      loading={pingLoading}
                      size="lg"
                      radius="xl"
                    >
                      <IconRefresh size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </SimpleGrid>
              
              {pingHistory.length > 0 && (
                <Group gap={6} mt="lg" justify="center">
                  {pingHistory.map((ping, idx) => (
                    <Tooltip key={idx} label={`${ping} ms`}>
                      <div 
                        style={{ 
                          width: 40, 
                          height: Math.min(60, ping / 5 + 20), 
                          background: ping < 100 ? '#22c55e' : ping < 300 ? '#14b89e' : ping < 800 ? '#f59e0b' : '#ef4444',
                          borderRadius: 8,
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }} 
                      />
                    </Tooltip>
                  ))}
                </Group>
              )}
            </Paper>

            <Divider label="Параметры подключения" labelPosition="center" />

            {/* Connection Details */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper withBorder p="md" radius="lg">
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <IconWifi size={18} color="var(--mantine-color-blue-6)" />
                    <Text fw={600} size="sm">Сервер</Text>
                  </Group>
                  <Badge color="blue" variant="light" radius="xl">Основной</Badge>
                </Group>
                <Group justify="space-between" align="flex-end">
                  <Text size="lg" fw={700} style={{ fontFamily: 'monospace' }}>{mtProxy.ip}</Text>
                  <Text size="lg" fw={700} style={{ fontFamily: 'monospace' }}>:{mtProxy.port}</Text>
                  <ActionIcon 
                    variant="subtle" 
                    onClick={() => {
                      clipboard.copy(`${mtProxy.ip}:${mtProxy.port}`);
                      notifications.show({ title: 'Готово', message: 'Сервер скопирован', color: 'green', icon: <IconCheck size={16} /> });
                    }}
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
              
              <Paper withBorder p="md" radius="lg">
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <IconShieldLock size={18} color="var(--mantine-color-violet-6)" />
                    <Text fw={600} size="sm">Секретный ключ</Text>
                  </Group>
                  <ActionIcon size="sm" variant="subtle" onClick={() => setSecretVisible(!secretVisible)}>
                    {secretVisible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                  </ActionIcon>
                </Group>
                <Group justify="space-between" align="flex-end">
                  <Text size="sm" style={{ fontFamily: 'monospace' }} fw={500}>
                    {secretVisible ? mtProxy.secret : '••••••••••••••••••••••••••••••••'}
                  </Text>
                  <ActionIcon 
                    variant="subtle" 
                    onClick={() => {
                      clipboard.copy(mtProxy.secret);
                      notifications.show({ title: 'Готово', message: 'Секрет скопирован', color: 'green', icon: <IconCheck size={16} /> });
                    }}
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            </SimpleGrid>


            <Divider />

            {/* Connection Actions */}
            <Group grow>
              <Button
                component="a"
                href={mtProxy.link}
                target="_blank"
                leftSection={<IconBrandTelegram size={18} />}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                radius="xl"
                size="lg"
              >
                Подключиться в Telegram
              </Button>
              <Button
                variant="light"
                onClick={() => {
                  setQrModalOpen(true);
                  setMtProxyModalOpen(false);
                }}
                leftSection={<IconQrcode size={18} />}
                radius="xl"
                size="lg"
              >
                Показать QR код
              </Button>
            </Group>

            <Text size="xs" c="dimmed" ta="center">
              Телеграм прокси обеспечивает безопасное и быстрое подключение к сервису через Telegram
            </Text>
          </Stack>
        </ScrollArea>
      </Modal>

      {/* OTP Modal */}
      <Modal
        opened={showOtp}
        onClose={() => {
          setShowOtp(false);
          setOtpToken('');
        }}
        title={
          <Group gap="xs">
            <IconShieldLock size={20} />
            <Text fw={600}>Подтверждение входа</Text>
          </Group>
        }
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">Введите код подтверждения из приложения аутентификации</Text>
          <TextInput
            label="Код подтверждения"
            placeholder="000000"
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            autoFocus
            radius="md"
            size="lg"
            leftSection={<IconLock size={18} />}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => {
              setShowOtp(false);
              setOtpToken('');
            }} radius="xl">
              Отмена
            </Button>
            <Button
              onClick={handleOtpSubmit}
              loading={loading}
              disabled={!otpToken}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'violet' }}
            >
              Подтвердить
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        opened={showResetPassword}
        onClose={() => {
          setShowResetPassword(false);
          setResetLoading(false);
        }}
        title="Восстановление пароля"
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">Введите ваш логин или email для получения ссылки на восстановление</Text>
          <TextInput
            label="Логин или Email"
            placeholder="username@example.com"
            value={loginOrEmail}
            onChange={(e) => setLoginOrEmail(e.target.value)}
            autoFocus
            radius="md"
            size="lg"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => {
              setShowResetPassword(false);
              setResetLoading(false);
            }} radius="xl">
              Отмена
            </Button>
            <Button
              leftSection={<IconMailForward size={16} />}
              onClick={handleResetPassword}
              loading={resetLoading}
              disabled={!loginOrEmail}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'violet' }}
            >
              Отправить
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* New Password Modal */}
      <Modal
        opened={showNewPasswordForm}
        onClose={() => {
          setShowNewPasswordForm(false);
          removeResetTokenCookie();
          setResetToken(null);
          setNewPasswordData({ password: '', confirmPassword: '' });
        }}
        title="Создание нового пароля"
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">Введите новый пароль для вашей учетной записи</Text>
          <PasswordInput
            label="Новый пароль"
            placeholder="Минимум 6 символов"
            value={newPasswordData.password}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, password: e.target.value })}
            autoFocus
            radius="md"
            size="lg"
          />
          <PasswordInput
            label="Подтверждение пароля"
            placeholder="Повторите пароль"
            value={newPasswordData.confirmPassword}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, confirmPassword: e.target.value })}
            radius="md"
            size="lg"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => {
              setShowNewPasswordForm(false);
              removeResetTokenCookie();
              setResetToken(null);
              setNewPasswordData({ password: '', confirmPassword: '' });
            }} radius="xl">
              Отмена
            </Button>
            <Button
              leftSection={<IconLock size={16} />}
              onClick={handleNewPasswordSubmit}
              loading={resetLoading}
              disabled={!newPasswordData.password || !newPasswordData.confirmPassword}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'violet' }}
            >
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* QR Modal */}
      <Modal 
        opened={qrModalOpen} 
        onClose={() => setQrModalOpen(false)} 
        title="QR код для подключения" 
        size="md" 
        centered 
        radius="xl"
      >
        <Stack align="center" gap="lg">
          <Card withBorder p="xl" style={{ background: 'white' }} radius="xl">
            <QRCodeSVG value={connectionString} size={280} level="H" includeMargin />
          </Card>
          <Text size="sm" ta="center">
            Отсканируйте QR код в Telegram для быстрого подключения
          </Text>
          <Button 
            variant="light" 
            leftSection={<IconCopy size={16} />} 
            onClick={() => {
              clipboard.copy(connectionString);
              notifications.show({ title: 'Готово', message: 'Строка подключения скопирована', color: 'green' });
            }} 
            fullWidth 
            radius="xl"
            size="lg"
          >
            Скопировать строку подключения
          </Button>
        </Stack>
      </Modal>

      {/* Verifying Modal */}
      {verifyingToken && (
        <Modal opened={true} onClose={() => {}} withCloseButton={false} centered>
          <Stack align="center" gap="md" py="xl">
            <Loader size="xl" />
            <Text>Проверка токена восстановления...</Text>
          </Stack>
        </Modal>
      )}

      {/* Support Button */}
      {config.SUPPORT_LINK && (
        <Button
          onClick={handleSupportLink}
          style={{ position: 'fixed', bottom: 24, right: 24 }}
          leftSection={<IconHeadset size={20} />}
          radius="xl"
          size="md"
          variant="light"
        >
          {t('common.support')}
        </Button>
      )}
    </Box>
  );
}
