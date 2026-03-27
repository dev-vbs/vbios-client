import { useEffect, useRef, useState } from 'react';
import {
  Card, Text, Stack, Button, TextInput, PasswordInput, Divider, Title,
  Modal, Group, Loader, Paper, Container, Center, Box,
  ThemeIcon, useMantineColorScheme, Anchor
} from '@mantine/core';
import { useForm, isEmail, hasLength } from '@mantine/form';
import {
  IconLogin, IconUserPlus, IconFingerprint, IconShieldLock,
  IconBrandTelegram, IconMailForward, IconLock, IconMail,
  IconKey, IconUser, IconAt, IconShield, IconArrowLeft,
  IconCircleCheck, IconX, IconRefresh, IconSend
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
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const modeRef = useRef(mode);
  modeRef.current = mode;

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
    const params = new URLSearchParams(location.search);
    if (params.has('register')) {
      setMode('register');
    }
  }, [location.search]);

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
          notifications.show({
            title: t('common.error'),
            message: t('auth.invalidResetToken'),
            color: 'red',
            icon: <IconX size={16} />
          });
          removeResetTokenCookie();
          setResetToken(null);
        }
      } catch {
        notifications.show({
          title: t('common.error'),
          message: t('auth.invalidResetToken'),
          color: 'red',
          icon: <IconX size={16} />
        });
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
      notifications.show({
        title: t('common.error'),
        message: t('auth.fillAllFields'),
        color: 'red'
      });
      return;
    }

    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.passwordsMismatch'),
        color: 'red'
      });
      return;
    }

    if (!resetToken) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.invalidResetToken'),
        color: 'red'
      });
      return;
    }

    setResetLoading(true);
    try {
      const response = await userApi.resetPasswordWithToken(resetToken, newPasswordData.password);
      const msg = response.data?.data?.[0]?.msg || response.data?.data?.msg;

      if (msg === 'Password reset successful') {
        notifications.show({
          title: t('common.success'),
          message: t('auth.passwordResetSuccess'),
          color: 'green',
          icon: <IconCircleCheck size={16} />
        });
      } else {
        notifications.show({
          title: t('common.error'),
          message: t('auth.invalidResetToken'),
          color: 'red'
        });
      }
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('auth.invalidResetToken'),
        color: 'red'
      });
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
      notifications.show({
        title: t('common.error'),
        message: t('auth.fillAllFields'),
        color: 'red'
      });
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
      notifications.show({
        title: t('common.success'),
        message: t('auth.loginSuccess'),
        color: 'green',
        icon: <IconCircleCheck size={16} />
      });
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 403 && axiosError.response?.data?.error?.includes('Password authentication is disabled')) {
        notifications.show({
          title: t('common.error'),
          message: t('auth.passwordAuthDisabled'),
          color: 'red'
        });
      } else {
        notifications.show({
          title: t('common.error'),
          message: t('auth.loginError'),
          color: 'red'
        });
      }
      setOtpToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpToken) {
      notifications.show({
        title: t('common.error'),
        message: t('otp.enterValidCode'),
        color: 'red'
      });
      return;
    }
    await handleLogin(otpToken);
  };

  const handleRegister = async () => {
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    const { login, password } = form.values;
    if (!login || !password) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.fillAllFields'),
        color: 'red'
      });
      return;
    }

    if (config.CAPTCHA_ENABLED === 'true' && (!captcha || !captchaAnswer.trim())) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.captchaRequired'),
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      await auth.register(login, password, captcha?.token, captchaAnswer || undefined);
      notifications.show({
        title: t('common.success'),
        message: t('auth.registerSuccess'),
        color: 'green',
        icon: <IconCircleCheck size={16} />
      });
      setMode('login');
      form.setValues({ confirmPassword: '' });
      setCaptchaAnswer('');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const errMsg = axiosError.response?.data?.error || '';
      if (errMsg === 'Invalid captcha') {
        notifications.show({
          title: t('common.error'),
          message: t('auth.captchaInvalid'),
          color: 'red'
        });
      } else if (errMsg === 'Captcha required') {
        notifications.show({
          title: t('common.error'),
          message: t('auth.captchaRequired'),
          color: 'red'
        });
      } else {
        notifications.show({
          title: t('common.error'),
          message: t('auth.registerError'),
          color: 'red'
        });
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

      notifications.show({
        title: t('common.success'),
        message: t('auth.telegramAuth'),
        color: 'green',
        icon: <IconCircleCheck size={16} />
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('auth.telegramAuthError'),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramWebAppAuth = async () => {
    if (!telegramWebApp?.initData) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.telegramAuthError'),
        color: 'red'
      });
      setShowLoginForm(true);
      return;
    }

    setLoading(true);
    try {
      const profile = config.TELEGRAM_WEBAPP_PROFILE || '';
      const authResponse = await auth.telegramWebAppAuth(telegramWebApp.initData, profile);
      const sessionId = authResponse.data?.session_id || authResponse.data?.id;
      if (!sessionId) {
        notifications.show({
          title: t('common.error'),
          message: t('auth.telegramAuthError'),
          color: 'red'
        });
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

      notifications.show({
        title: t('common.success'),
        message: t('auth.telegramAuth'),
        color: 'green',
        icon: <IconCircleCheck size={16} />
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('auth.telegramAuthError'),
        color: 'red'
      });
      setShowLoginForm(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginOrEmail) {
      notifications.show({
        title: t('common.error'),
        message: t('auth.resetEnterLogin'),
        color: 'red'
      });
      return;
    }

    setResetLoading(true);
    try {
      const loginResponse = await userApi.resetPassword({ login: loginOrEmail });
      const loginMsg = loginResponse.data?.data?.[0]?.msg || loginResponse.data?.data?.msg;
      if (loginMsg === 'Successful') {
        notifications.show({
          title: t('common.success'),
          message: t('auth.resetSuccess'),
          color: 'green',
          icon: <IconCircleCheck size={16} />
        });
        setShowResetPassword(false);
        setResetLoading(false);
        return;
      }

      const emailResponse = await userApi.resetPassword({ email: loginOrEmail });
      const emailMsg = emailResponse.data?.data?.[0]?.msg || emailResponse.data?.data?.msg;
      if (emailMsg === 'Successful') {
        notifications.show({
          title: t('common.success'),
          message: t('auth.resetSuccess'),
          color: 'green',
          icon: <IconCircleCheck size={16} />
        });
        setShowResetPassword(false);
        setResetLoading(false);
        return;
      }

      notifications.show({
        title: t('common.error'),
        message: t('auth.resetNotFound'),
        color: 'red'
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('auth.resetNotFound'),
        color: 'red'
      });
    }
    setResetLoading(false);
  };

  const handlePasskeyAuth = async () => {
    if (!isWebAuthnSupported) {
      notifications.show({
        title: t('common.error'),
        message: t('passkey.notSupported'),
        color: 'red'
      });
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

      notifications.show({
        title: t('common.success'),
        message: t('auth.loginSuccess'),
        color: 'green',
        icon: <IconCircleCheck size={16} />
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('passkey.authError'),
        color: 'red'
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Center h="100vh" style={{ position: 'relative', background: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-0)' }}>
      <Container size="sm">
        <Card
          withBorder
          radius="xl"
          p="xl"
          bg={isDark ? 'dark.6' : 'white'}
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <Stack gap="xl">
            {/* Header with logo and language switcher */}
            <Group justify="space-between" align="center">
              <Box>
                <Title order={1} size="h2" fw={800}>
                  {config.APP_NAME}
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                  {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
                </Text>
              </Box>
              <LanguageSwitcher />
            </Group>

            {hasTelegramWebAppAuth && !showLoginForm && (
              <>
                <Button
                  color="blue"
                  leftSection={<IconBrandTelegram size={20} />}
                  onClick={handleTelegramWebAppAuth}
                  fullWidth
                  loading={loading}
                  radius="xl"
                  size="lg"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
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
                  leftSection={<IconArrowLeft size={18} />}
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
                  <Stack gap="md">
                    {mode === 'register' && requireEmailRegister ? (
                      <TextInput
                        label={t('auth.emailLabel')}
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        name="email"
                        type="email"
                        leftSection={<IconAt size={18} />}
                        radius="md"
                        size="md"
                        {...form.getInputProps('login')}
                      />
                    ) : (
                      <TextInput
                        label={t('auth.loginLabel')}
                        placeholder={t('auth.loginPlaceholder')}
                        autoComplete="username"
                        name="username"
                        leftSection={<IconUser size={18} />}
                        radius="md"
                        size="md"
                        {...form.getInputProps('login')}
                      />
                    )}

                    <PasswordInput
                      label={t('auth.passwordLabel')}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      name="password"
                      leftSection={<IconLock size={18} />}
                      radius="md"
                      size="md"
                      {...form.getInputProps('password')}
                    />

                    {mode === 'register' && (
                      <PasswordInput
                        label={t('auth.confirmPasswordLabel')}
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                        autoComplete="new-password"
                        name="confirm-password"
                        leftSection={<IconShield size={18} />}
                        radius="md"
                        size="md"
                        {...form.getInputProps('confirmPassword')}
                      />
                    )}

                    {mode === 'register' && config.CAPTCHA_ENABLED === 'true' && (
                      <Paper withBorder p="xs" radius="lg" bg={isDark ? 'dark.7' : 'gray.0'}>
                        <Group gap="xs" align="flex-end">
                          <TextInput
                            style={{ flex: 1 }}
                            label={t('auth.captchaLabel')}
                            description={captcha ? `${captcha.question} = ?` : 'Загрузка...'}
                            placeholder={t('auth.captchaPlaceholder')}
                            value={captchaAnswer}
                            onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
                            disabled={!captcha}
                            radius="md"
                          />
                          <Button
                            variant="subtle"
                            size="sm"
                            px={8}
                            onClick={fetchCaptcha}
                            title={t('auth.captchaRefresh')}
                            radius="xl"
                          >
                            <IconRefresh size={18} />
                          </Button>
                        </Group>
                      </Paper>
                    )}

                    <Button
                      type="submit"
                      leftSection={mode === 'login' ? <IconLogin size={20} /> : <IconUserPlus size={20} />}
                      loading={loading}
                      size="lg"
                      radius="xl"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                      fullWidth
                    >
                      {mode === 'login' ? t('auth.login') : t('auth.register')}
                    </Button>

                    {mode === 'login' && isWebAuthnSupported && hasTelegramWidget && config.PASSKEY_AUTH_DISABLED === 'false' && (
                      <Button
                        variant="light"
                        leftSection={<IconFingerprint size={20} />}
                        loading={passkeyLoading}
                        onClick={handlePasskeyAuth}
                        radius="xl"
                        size="md"
                        fullWidth
                      >
                        {t('passkey.loginWithPasskey')}
                      </Button>
                    )}
                  </Stack>
                </form>

                <Divider />

                <Stack gap="xs">
                  <Group justify="center">
                    <Text size="sm" c="dimmed">
                      {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
                    </Text>
                    <Anchor
                      component="button"
                      type="button"
                      onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        form.clearErrors();
                      }}
                      fw={600}
                      size="sm"
                    >
                      {mode === 'login' ? t('auth.register') : t('auth.login')}
                    </Anchor>
                  </Group>

                  {mode === 'login' && (
                    <Group justify="center">
                      <Anchor
                        component="button"
                        type="button"
                        onClick={() => setShowResetPassword(true)}
                        size="sm"
                      >
                        {t('auth.forgotPassword')}
                      </Anchor>
                    </Group>
                  )}
                </Stack>

                {hasTelegramWebAppAuth && showLoginForm && (
                  <>
                    <Divider label={t('common.or')} labelPosition="center" />
                    <Button
                      variant="outline"
                      color="blue"
                      leftSection={<IconBrandTelegram size={20} />}
                      onClick={handleTelegramWebAppAuth}
                      fullWidth
                      loading={loading}
                      radius="xl"
                      size="md"
                    >
                      {t('auth.loginWithTelegram')}
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        </Card>

        {/* OTP Modal */}
        <Modal
          opened={showOtp}
          onClose={() => {
            setShowOtp(false);
            setOtpToken('');
          }}
          title={
            <Group gap="xs">
              <ThemeIcon size="md" radius="xl" color="blue" variant="light">
                <IconShieldLock size={18} />
              </ThemeIcon>
              <Text fw={600}>{t('otp.title')}</Text>
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
              size="md"
              leftSection={<IconKey size={18} />}
            />
            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                onClick={() => {
                  setShowOtp(false);
                  setOtpToken('');
                }}
                radius="xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleOtpSubmit}
                loading={loading}
                disabled={!otpToken}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
              >
                {t('otp.verify')}
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
          title={
            <Group gap="xs">
              <ThemeIcon size="md" radius="xl" color="orange" variant="light">
                <IconMailForward size={18} />
              </ThemeIcon>
              <Text fw={600}>{t('auth.resetPasswordTitle')}</Text>
            </Group>
          }
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
              leftSection={<IconMail size={18} />}
            />
            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetLoading(false);
                }}
                radius="xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                leftSection={<IconSend size={18} />}
                onClick={handleResetPassword}
                loading={resetLoading}
                disabled={!loginOrEmail}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'orange', to: 'red', deg: 135 }}
              >
                {t('auth.resetPasswordSend')}
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
          title={
            <Group gap="xs">
              <ThemeIcon size="md" radius="xl" color="green" variant="light">
                <IconLock size={18} />
              </ThemeIcon>
              <Text fw={600}>{t('auth.newPasswordTitle')}</Text>
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
              leftSection={<IconLock size={18} />}
            />
            <PasswordInput
              label={t('auth.confirmNewPasswordLabel')}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              value={newPasswordData.confirmPassword}
              onChange={(e) => setNewPasswordData({ ...newPasswordData, confirmPassword: e.target.value })}
              radius="md"
              leftSection={<IconShield size={18} />}
            />
            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                onClick={() => {
                  setShowNewPasswordForm(false);
                  removeResetTokenCookie();
                  setResetToken(null);
                  setNewPasswordData({ password: '', confirmPassword: '' });
                }}
                radius="xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                leftSection={<IconLock size={18} />}
                onClick={handleNewPasswordSubmit}
                loading={resetLoading}
                disabled={!newPasswordData.password || !newPasswordData.confirmPassword}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'green', to: 'teal', deg: 135 }}
              >
                {t('auth.resetPasswordButton')}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Verification Modal */}
        <Modal
          opened={verifyingToken}
          onClose={() => {}}
          withCloseButton={false}
          centered
          radius="xl"
        >
          <Stack align="center" gap="md" py="xl">
            <Loader size="lg" variant="dots" />
            <Text c="dimmed">{t('auth.verifyingToken')}</Text>
          </Stack>
        </Modal>
      </Container>
    </Center>
  );
}
