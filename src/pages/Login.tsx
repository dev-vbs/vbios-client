import { useEffect, useRef, useState } from 'react';
import { 
  Card, Text, Stack, Button, ActionIcon, TextInput, PasswordInput, 
  Divider, Title, Center, Modal, Group, Loader, useMantineColorScheme, 
  useComputedColorScheme, Grid, Paper, Tooltip, Box, Badge, 
  ThemeIcon, Transition, ScrollArea
} from '@mantine/core';
import { useForm, isEmail, hasLength } from '@mantine/form';
import { 
  IconLogin, IconUserPlus, IconHeadset, IconFingerprint, 
  IconShieldLock, IconBrandTelegram, IconMailForward, IconLock, 
  IconMoon, IconSun, IconServer, IconCopy, 
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
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('register')) {
      setMode('register');
    }
  }, [location.search]);
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

  // Average ping from history
  const avgPing = pingHistory.length > 0 
    ? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length) 
    : 0;

  return (
    <Box pos="relative" mih="100vh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mantine-color-body)' }}>
      <Center style={{ minHeight: '80vh', padding: '20px' }}>
        <Card withBorder radius="xl" p="xl" w={420} shadow="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                <ThemeToggle />
              </div>
              <Group gap="xs" align="center" style={{ flex: 'auto', justifyContent: 'center' }}>
                {config.LOGO_URL ? (
                  <img
                    src={config.LOGO_URL}
                    alt=""
                    style={{ height: 32, width: 32, objectFit: 'contain', flexShrink: 0 }}
                  />
                ) : (
                  <ThemeIcon size={32} radius="md" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                    <IconNetwork size={18} />
                  </ThemeIcon>
                )}
                <Title order={2} ta="center" c="blue.6">
                  {config.APP_NAME}
                </Title>
              </Group>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <LanguageSwitcher />
              </div>
            </Group>
            
            {config.APP_DESCRIPTION && (
              <Text size="sm" c="dimmed" ta="center">{config.APP_DESCRIPTION}</Text>
            )}
            
            <Divider />
            
            <Text size="sm" fw={500} ta="center" c="dimmed">
              {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
            </Text>

            {hasTelegramWebAppAuth && !showLoginForm && (
              <>
                <Button
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  leftSection={<IconBrandTelegram size={18} />}
                  onClick={handleTelegramWebAppAuth}
                  fullWidth
                  loading={loading}
                  radius="xl"
                  size="md"
                >
                  {t('auth.loginWithTelegram')}
                </Button>

                <Divider label={t('common.or')} labelPosition="center" />

                <Button
                  variant="light"
                  onClick={() => setShowLoginForm(true)}
                  fullWidth
                  radius="xl"
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

            {(!hasTelegramWebAppAuth || showLoginForm) && (
              <>
                <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    {mode === 'register' && requireEmailRegister ? (
                      <TextInput
                        label={t('auth.emailLabel')}
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        name="email"
                        type="email"
                        radius="md"
                        {...form.getInputProps('login')}
                      />
                    ) : (
                      <TextInput
                        label={t('auth.loginLabel')}
                        placeholder={t('auth.loginPlaceholder')}
                        autoComplete="username"
                        name="username"
                        radius="md"
                        {...form.getInputProps('login')}
                      />
                    )}
                    <PasswordInput
                      label={t('auth.passwordLabel')}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      name="password"
                      radius="md"
                      {...form.getInputProps('password')}
                    />
                    {mode === 'register' && (
                      <PasswordInput
                        label={t('auth.confirmPasswordLabel')}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        autoComplete="new-password"
                        name="confirm-password"
                        radius="md"
                        {...form.getInputProps('confirmPassword')}
                      />
                    )}
                    {mode === 'register' && config.CAPTCHA_ENABLED === 'true' && (
                      <Group gap="xs" align="flex-end">
                        <TextInput
                          style={{ flex: 1 }}
                          label={t('auth.captchaLabel')}
                          description={captcha ? `${captcha.question} = ?` : '…'}
                          placeholder={t('auth.captchaPlaceholder')}
                          value={captchaAnswer}
                          onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
                          disabled={!captcha}
                          radius="md"
                        />
                        <ActionIcon variant="light" size="lg" onClick={fetchCaptcha} title={t('auth.captchaRefresh')}>
                          ↻
                        </ActionIcon>
                      </Group>
                    )}
                    <Button
                      type="submit"
                      leftSection={mode === 'login' ? <IconLogin size={18} /> : <IconUserPlus size={18} />}
                      loading={loading}
                      radius="xl"
                      size="md"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'violet' }}
                    >
                      {mode === 'login' ? t('auth.login') : t('auth.register')}
                    </Button>
                    {mode === 'login' && isWebAuthnSupported && hasTelegramWidget && config.PASSKEY_AUTH_DISABLED === 'false' && (
                      <Button
                        variant="light"
                        leftSection={<IconFingerprint size={18} />}
                        loading={passkeyLoading}
                        onClick={handlePasskeyAuth}
                        radius="xl"
                      >
                        {t('passkey.loginWithPasskey')}
                      </Button>
                    )}
                  </Stack>
                </form>

                <Text size="sm" ta="center">
                  {mode === 'login' ? (
                    <>
                      {t('auth.noAccount')}{' '}
                      <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => { setMode('register'); form.clearErrors(); }}>
                        {t('auth.register')}
                      </Text>
                    </>
                  ) : (
                    <>
                      {t('auth.hasAccount')}{' '}
                      <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => { setMode('login'); form.clearErrors(); }}>
                        {t('auth.login')}
                      </Text>
                    </>
                  )}
                </Text>

                {mode === 'login' && (
                  <Text size="sm" ta="center">
                    <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => setShowResetPassword(true)}>
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
                style={{
                  ...styles,
                  position: 'fixed',
                  bottom: 24,
                  left: 24,
                  zIndex: 100,
                }}
                leftSection={<IconPlugConnected size={18} />}
                radius="xl"
                size="md"
                variant="light"
                color="blue"
              >
                MTProxy
                <Badge size="xs" color={pingStatus.color} ml={8} circle />
              </Button>
            )}
          </Transition>
        )}
      </Center>

      {/* MTProxy Modal */}
      <Modal
        opened={mtProxyModalOpen}
        onClose={() => setMtProxyModalOpen(false)}
        title={
          <Group gap="xs">
            <IconServer size={24} color="#0088cc" />
            <Text fw={700} size="lg">MTProxy Подключение</Text>
          </Group>
        }
        size="lg"
        centered
        radius="xl"
        padding="lg"
      >
        <ScrollArea h={500}>
          <Stack gap="lg">
            {/* Status Card */}
            <Paper withBorder p="md" radius="xl" bg={pingStatus.color === 'green' ? 'green.0' : pingStatus.color === 'red' ? 'red.0' : undefined}>
              <Group justify="space-between" align="center">
                <Group gap="md">
                  <ThemeIcon size={48} radius="xl" color={pingStatus.color} variant="light">
                    <pingStatus.icon size={28} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Статус соединения</Text>
                    <Text fw={700} size="xl" c={pingStatus.color}>{pingStatus.text}</Text>
                    <Group gap="xs" mt={4}>
                      <Text size="sm">Пинг: <Text component="span" fw={700}>{pingValue}</Text></Text>
                      {avgPing > 0 && (
                        <Text size="xs" c="dimmed">(средний: {avgPing} ms)</Text>
                      )}
                    </Group>
                  </div>
                </Group>
                <Tooltip label="Проверить задержку">
                  <ActionIcon 
                    variant="light" 
                    onClick={checkProxyPing}
                    loading={pingLoading}
                    size="lg"
                    radius="xl"
                  >
                    <IconRefresh size={20} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              
              {pingHistory.length > 0 && (
                <Group gap={4} mt="md" justify="center">
                  {pingHistory.map((ping, idx) => (
                    <Tooltip key={idx} label={`${ping} ms`}>
                      <div 
                        style={{ 
                          width: 30, 
                          height: Math.min(40, ping / 10 + 10), 
                          background: ping < 100 ? '#22c55e' : ping < 300 ? '#14b89e' : ping < 800 ? '#f59e0b' : '#ef4444',
                          borderRadius: 4,
                          transition: 'all 0.3s'
                        }} 
                      />
                    </Tooltip>
                  ))}
                </Group>
              )}
            </Paper>

            <Divider label="Параметры подключения" labelPosition="center" />

            {/* Connection Details */}
            <Grid>
              <Grid.Col span={6}>
                <Paper withBorder p="md" radius="lg">
                  <Group justify="space-between" mb="xs">
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
                        notifications.show({ title: 'Готово', message: 'Сервер скопирован', color: 'green' });
                      }}
                    >
                      <IconCopy size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              </Grid.Col>
              
              <Grid.Col span={6}>
                <Paper withBorder p="md" radius="lg">
                  <Group justify="space-between" mb="xs">
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
                        notifications.show({ title: 'Готово', message: 'Секрет скопирован', color: 'green' });
                      }}
                    >
                      <IconCopy size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* QR Code Section */}
            <Paper withBorder p="md" radius="lg" bg="gray.0" style={{ background: 'var(--mantine-color-gray-0)' }}>
              <Group justify="space-between" align="center" mb="md">
                <Group gap="xs">
                  <IconQrcode size={20} />
                  <Text fw={600}>Быстрое подключение</Text>
                </Group>
                <Badge color="teal" variant="light">Рекомендуется</Badge>
              </Group>
              
              <Grid align="center">
                <Grid.Col span="auto">
                  <Center>
                    <Card withBorder p="md" style={{ background: 'white' }} radius="lg">
                      <QRCodeSVG value={connectionString} size={150} level="H" includeMargin />
                    </Card>
                  </Center>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="sm">
                    <Text size="sm" fw={500}>Сканируйте QR код:</Text>
                    <Text size="xs" c="dimmed">
                      1. Откройте Telegram на телефоне<br />
                      2. Нажмите на иконку QR-кода в поиске<br />
                      3. Наведите камеру на этот код
                    </Text>
                    <Button 
                      variant="light" 
                      leftSection={<IconCopy size={16} />} 
                      onClick={() => {
                        clipboard.copy(connectionString);
                        notifications.show({ title: 'Готово', message: 'Строка подключения скопирована', color: 'green' });
                      }} 
                      size="xs"
                      radius="xl"
                    >
                      Скопировать ссылку
                    </Button>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Paper>

            <Divider />

            {/* Connection Actions */}
            <Group grow>
              <Button
                component="a"
                href={mtProxy.link}
                target="_blank"
                leftSection={<IconBrandTelegram size={18} />}
                variant="filled"
                color="blue"
                radius="xl"
                size="md"
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
              >
                Показать QR код
              </Button>
            </Group>

            <Text size="xs" c="dimmed" ta="center">
              MTProxy обеспечивает безопасное и быстрое подключение к сервису через Telegram
            </Text>
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Existing Modals */}
      <Modal
        opened={showOtp}
        onClose={() => {
          setShowOtp(false);
          setOtpToken('');
        }}
        title={
          <Group gap="xs">
            <IconShieldLock size={20} />
            <Text fw={500}>{t('otp.title')}</Text>
          </Group>
        }
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('otp.verifyDescription')}</Text>
          <TextInput
            label={t('otp.enterCode')}
            placeholder="000000"
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            autoFocus
            radius="md"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowOtp(false);
              setOtpToken('');
            }} radius="xl">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOtpSubmit}
              loading={loading}
              disabled={!otpToken}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'violet' }}
            >
              {t('otp.verify')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showResetPassword}
        onClose={() => {
          setShowResetPassword(false);
          setResetLoading(false);
        }}
        title={t('auth.resetPasswordTitle')}
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('auth.resetPasswordDescription')}</Text>
          <TextInput
            label={t('auth.loginOrEmail')}
            placeholder={t('auth.loginOrEmailPlaceholder')}
            value={loginOrEmail}
            onChange={(e) => setLoginOrEmail(e.target.value)}
            autoFocus
            radius="md"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowResetPassword(false);
              setResetLoading(false);
            }} radius="xl">
              {t('common.cancel')}
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
              {t('auth.resetPasswordSend')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={showNewPasswordForm}
        onClose={() => {
          setShowNewPasswordForm(false);
          removeResetTokenCookie();
          setResetToken(null);
          setNewPasswordData({ password: '', confirmPassword: '' });
        }}
        title={
          <Group gap="xs">
            <IconLock size={20} />
            <Text fw={500}>{t('auth.newPasswordTitle')}</Text>
          </Group>
        }
        centered
        radius="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t('auth.newPasswordDescription')}</Text>
          <PasswordInput
            label={t('auth.newPasswordLabel')}
            placeholder={t('auth.passwordPlaceholder')}
            value={newPasswordData.password}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, password: e.target.value })}
            autoFocus
            radius="md"
          />
          <PasswordInput
            label={t('auth.confirmNewPasswordLabel')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={newPasswordData.confirmPassword}
            onChange={(e) => setNewPasswordData({ ...newPasswordData, confirmPassword: e.target.value })}
            radius="md"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => {
              setShowNewPasswordForm(false);
              removeResetTokenCookie();
              setResetToken(null);
              setNewPasswordData({ password: '', confirmPassword: '' });
            }} radius="xl">
              {t('common.cancel')}
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
              {t('auth.resetPasswordButton')}
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
        <Stack align="center" gap="md">
          <Card withBorder p="xl" style={{ background: 'white' }} radius="xl">
            <QRCodeSVG value={connectionString} size={250} level="H" includeMargin />
          </Card>
          <Text size="sm" ta="center">
            Отсканируйте QR код в Telegram для быстрого подключения
          </Text>
          <Button 
            variant="light" 
            leftSection={<IconCopy size={16} />} 
            onClick={() => {
              clipboard.copy(connectionString);
              notifications.show({ 
                title: 'Готово', 
                message: 'Строка подключения скопирована', 
                color: 'green' 
              });
            }} 
            fullWidth 
            radius="xl"
          >
            Скопировать строку подключения
          </Button>
        </Stack>
      </Modal>

      {verifyingToken && (
        <Modal opened={true} onClose={() => {}} withCloseButton={false} centered>
          <Stack align="center" gap="md">
            <Loader />
            <Text>{t('auth.verifyingToken')}</Text>
          </Stack>
        </Modal>
      )}

      {config.SUPPORT_LINK && (
        <Button
          onClick={handleSupportLink}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
          }}
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
