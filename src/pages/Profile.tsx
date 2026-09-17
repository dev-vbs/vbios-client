import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Text, Stack, Group, Divider, Grid, Button, TextInput, Tooltip, ActionIcon, Avatar, Title, Modal, Loader, Center, Collapse, Alert, Skeleton, useMantineColorScheme, Accordion } from '@mantine/core';
import { IconUser, IconPhone, IconCopy, IconCheck, IconBrandTelegram, IconCreditCard, IconChevronDown, IconChevronUp, IconMail, IconAlertCircle, IconGift, IconLink, IconPencil, IconShieldCheck, IconWallet, IconListCheck, IconHelpCircle, IconArrowRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useClipboard } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { userApi, telegramApi, userEmailApi } from '../api/client';
import { encodePartnerIdBase64url } from '../api/cookie';
import PayModal from '../components/PayModal';
import PromoModal from '../components/PromoModal';
import SecuritySettings from '../components/security/SecuritySettings';
import { useStore } from '../store/useStore';
import { config } from '../config';
import { hasTelegramWidget } from '../constants/webapp';

const RESEND_COOLDOWN_MS = 3 * 60 * 1000;
const RESEND_STORAGE_KEY = 'email_verify_last_sent';

interface UserProfile {
  user_id: number;
  login: string;
  login2: string;
  full_name?: string;
  phone?: string;
  balance: number;
  credit: number;
  discount: number;
  bonus: number;
  gid: number;
}

interface ForecastNextItem {
  name: string;
  cost: number;
  total: number;
  months: number;
  qnt: number;
  service_id: number;
  bonus: number;
  discount: number;
}

interface ForecastItem {
  name: string;
  cost: number;
  total: number;
  status: string;
  service_id: string;
  user_service_id: string;
  months: number;
  discount: number;
  qnt: number;
  expire?: string;
  next?: ForecastNextItem;
}

interface ForecastData {
  balance: number;
  bonuses: number;
  dept: number;
  total: number;
  items: ForecastItem[];
}

export default function Profile() {
  const navigate = useNavigate();
  const { telegramPhoto, userEmail: storeEmail, userEmailVerified: storeEmailVerified, setUserEmail, setUserEmailVerified, isEmailLoaded, setOpenEmailModal } = useStore();
  const emailBlocked = config.EMAIL_REQUIRED === 'true' && isEmailLoaded && !storeEmail;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '', login2: '' });
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramWaitingOpen, setTelegramWaitingOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalAmount, setPayModalAmount] = useState<number | undefined>(undefined);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [profileEmail, setProfileEmail] = useState<string | null>(storeEmail);
  const [emailVerified, setEmailVerified] = useState<number>(storeEmailVerified || 0);

  useEffect(() => {
    setProfileEmail(storeEmail);
  }, [storeEmail]);

  useEffect(() => {
    setEmailVerified(storeEmailVerified || 0);
  }, [storeEmailVerified]);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyConfirming, setVerifyConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unbindConfirmOpen, setUnbindConfirmOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const clipboardId = useClipboard({ timeout: 1000 });
  const clipboardLink = useClipboard({ timeout: 1000 });
  const { t } = useTranslation();
  const basePath = config.SHM_BASE_PATH && config.SHM_BASE_PATH !== '/' ? config.SHM_BASE_PATH : '';
  const partnerLink = `${window.location.origin}${basePath}?partner_id=${encodePartnerIdBase64url(profile?.user_id || 0)}`;

  const updateCooldown = useCallback(() => {
    const lastSent = localStorage.getItem(RESEND_STORAGE_KEY);
    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent, 10);
      const remaining = Math.max(0, RESEND_COOLDOWN_MS - elapsed);
      setResendCooldown(Math.ceil(remaining / 1000));
    } else {
      setResendCooldown(0);
    }
  }, []);

  useEffect(() => {
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [updateCooldown]);

  const loadTelegramSettings = useCallback(async () => {
    setTelegramLoading(true);
    try {
      const telegramResponse = await Promise.race([
        telegramApi.getSettings(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('telegram settings timeout')), 10000)),
      ]);
      setTelegramUsername(telegramResponse.data.username || null);
    } catch {
    } finally {
      setTelegramLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userApi.getProfile();
        const responseData = response.data.data;
        const data = Array.isArray(responseData) ? responseData[0] : responseData;
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          login2: data.login2 || '',
        });
        try {
          const forecastResponse = await userApi.getForecast();
          const forecastData = forecastResponse.data.data;
          if (Array.isArray(forecastData) && forecastData.length > 0) {
            setForecast(forecastData[0]);
          }
        } catch {
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tgStatus = params.get('tg_status');

    if (!tgStatus) return;

    params.delete('tg_status');
    params.delete('session_id');
    params.delete('msg');
    params.delete('error');
    const nextSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash);

    if (tgStatus === 'success') {
      notifications.show({
        title: t('common.success'),
        message: t('auth.telegramBind'),
        color: 'green',
      });
      if (config.ALLOW_TELEGRAM_PIN === 'true' || hasTelegramWidget) {
        loadTelegramSettings();
      }
      return;
    }

    if (tgStatus === 'already_bound') {
      notifications.show({
        title: t('common.error'),
        message: t('profile.telegramAlreadyBound'),
        color: 'orange',
      });
      return;
    }

    notifications.show({
      title: t('common.error'),
      message: t('auth.telegramBindError'),
      color: 'red',
    });
  }, [t, loadTelegramSettings]);

  useEffect(() => {
    if (!profile) return;

    const loadExtras = async () => {
      if (config.ALLOW_TELEGRAM_PIN === 'true' || hasTelegramWidget) {
        await loadTelegramSettings();
      }

      // email уже загружен в стор при старте (App.tsx checkAuth)
    };

    loadExtras();
  }, [profile, loadTelegramSettings]);

  const handleSave = async () => {
    try {
      await userApi.updateProfile(formData);
      setProfile((prev) => prev ? { ...prev, ...formData } : null);
      setEditing(false);
      notifications.show({
        title: t('common.success'),
        message: t('profile.profileUpdated'),
        color: 'green',
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('profile.profileUpdateError'),
        color: 'red',
      });
    }
  };

  const refreshProfile = async () => {
    const profileResponse = await userApi.getProfile();
    const profileData = profileResponse.data.data;
    const data = Array.isArray(profileData) ? profileData[0] : profileData;
    setProfile(data);
  };

  const handleTelegramOidcBind = async (event: any) => {
    event.preventDefault();
    if (!profile) return;

    setTelegramWaitingOpen(true);
    try {
      const params = new URLSearchParams({
        uid: String(profile.user_id),
        return_url: `${window.location.origin}${window.location.pathname}${window.location.search}`,
        profile: config.TELEGRAM_BOT_AUTH_PROFILE,
        bind_to_profile: '1',
        register_if_not_exists: '0',
      });
      const startUrl = `/shm/v1/telegram/web/auth/start?${params.toString()}`;

      const popup = window.open(startUrl, 'telegram-oidc-auth', 'popup=yes,width=520,height=760');
      if (!popup) {
        throw new Error('Telegram OIDC popup blocked');
      }

      const startedAt = Date.now();
      const pollTimer = window.setInterval(async () => {
        if (!popup.closed) {
          if (Date.now() - startedAt < 180000) {
            return;
          }
          window.clearInterval(pollTimer);
          setTelegramWaitingOpen(false);
          return;
        }

        window.clearInterval(pollTimer);
        setTelegramWaitingOpen(false);
        await loadTelegramSettings();
      }, 700);
    } catch {
      setTelegramWaitingOpen(false);
      notifications.show({
        title: t('common.error'),
        message: t('auth.telegramBindError'),
        color: 'red',
      });
    }
  };

  const handleTelegramUnbind = async () => {
    setTelegramLoading(true);
    try {
      await telegramApi.unbindAccount();
      setTelegramUsername(null);
      setUnbindConfirmOpen(false);
      notifications.show({
        title: t('common.success'),
        message: 'Telegram успешно отвязан',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: 'Не удалось отвязать Telegram',
        color: 'red',
      });
    } finally {
      setTelegramLoading(false);
    }
  };

  const openEmailModal = () => {
    setEmailInput(profileEmail || '');
    setEmailModalOpen(true);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getEmailErrorMessage = (serverMsg: string): string => {
    const normalizedServerMsg = serverMsg.trim().toLowerCase();
    const errorMap: Record<string, string> = {
      'is not email': t('profile.invalidEmail'),
      'Email mismatch. Use the email shown in your profile.': t('profile.emailMismatch'),
      'Invalid code': t('profile.invalidCode'),
      'Code expired': t('profile.codeExpired'),
      'already in use': t('profile.emailAlreadyInUse'),
      'email already in use': t('profile.emailAlreadyInUse'),
    };
    return errorMap[serverMsg] || errorMap[normalizedServerMsg] || serverMsg;
  };

  const handleSaveEmail = async () => {
    const email = emailInput.trim();

    if (email === profileEmail) {
      notifications.show({
        title: t('common.error'),
        message: t('profile.isCurrentEmail'),
        color: 'red',
      });
      return;
    }

    setEmailSaving(true);
    try {
      const response = await userEmailApi.setEmail(email);
      const data = response.data?.data;

      if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Successful') {
        notifications.show({
          title: t('common.error'),
          message: getEmailErrorMessage(data[0].msg),
          color: 'red',
        });
        return;
      }

      setProfileEmail(email || null);
      if (setUserEmail) {
        setUserEmail(email);
      }

      setEmailModalOpen(false);
      notifications.show({
        title: t('common.success'),
        message: t('profile.emailSaved'),
        color: 'green',
      });
      setEmailVerified(0);
      setUserEmailVerified(0);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('profile.emailSaveError'),
        color: 'red',
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDeleteEmail = async () => {
    setEmailSaving(true);
    try {
      await userEmailApi.deleteEmail();
      setProfileEmail(null);
      if (setUserEmail) {
        setUserEmail(null);
      }
      notifications.show({
        title: t('common.success'),
        message: t('common.success'),
        color: 'green',
      });
      setEmailModalOpen(false);
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('common.error'),
        color: 'red',
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSendVerifyCode = async () => {
    if (!profileEmail) return;
    if (resendCooldown > 0) return;

    setVerifySending(true);
    try {
      const response = await userEmailApi.sendVerifyCode(profileEmail);
      const data = response.data?.data;

      if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Verification code sent') {
        notifications.show({
          title: t('common.error'),
          message: getEmailErrorMessage(data[0].msg),
          color: 'red',
        });
        return;
      }

      localStorage.setItem(RESEND_STORAGE_KEY, Date.now().toString());
      updateCooldown();

      setVerifyModalOpen(true);
      setVerifyCode('');
      notifications.show({
        title: t('common.success'),
        message: t('profile.verifyCodeSent'),
        color: 'green',
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('profile.verifyCodeError'),
        color: 'red',
      });
    } finally {
      setVerifySending(false);
    }
  };

  const handleConfirmEmail = async () => {
    if (!verifyCode.trim()) return;

    setVerifyConfirming(true);
    try {
      const response = await userEmailApi.confirmEmail(verifyCode.trim());
      const data = response.data?.data;

      if (Array.isArray(data) && data[0]?.msg && data[0].msg !== 'Email verified successfully') {
        notifications.show({
          title: t('common.error'),
          message: getEmailErrorMessage(data[0].msg),
          color: 'red',
        });
        return;
      }

      setEmailVerified(1);
      setUserEmailVerified(1);
      setVerifyModalOpen(false);
      notifications.show({
        title: t('common.success'),
        message: t('profile.emailVerifiedSuccess'),
        color: 'green',
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('profile.emailVerifyError'),
        color: 'red',
      });
    } finally {
      setVerifyConfirming(false);
    }
  };

  if (loading || !profile) {
    return (
      <Center h="50vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" className="profile-workspace">
      <Group justify="space-between" align="flex-end" className="profile-page-heading">
        <div>
          <Title order={1}>{t('profile.title')}</Title>
          <Text c="dimmed" size="sm">Управляйте данными, балансом и настройками аккаунта</Text>
        </div>
        <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)} visibleFrom="sm">
          {t('common.edit')}
        </Button>
      </Group>

      <Card className="profile-hero" p="xl">
        <Grid align="center" gutter="xl">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Group wrap="nowrap" align="center">
              <Avatar className="profile-avatar" size={88} radius="xl" src={telegramPhoto || undefined}>
                {profile.full_name?.charAt(0) || profile.login?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Text fw={700} size="xl" truncate>{profile.full_name || profile.login || t('profile.user')}</Text>
                <Text c="dimmed" size="sm" truncate>@{profile.login || '-'}</Text>
                <Group gap={6} mt={8}>
                  <IconShieldCheck size={16} color="#20d287" />
                  <Text size="xs" c="green" fw={600}>Аккаунт активен</Text>
                </Group>
              </div>
            </Group>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Grid gutter="sm">
              <Grid.Col span={4}>
                <div className="profile-stat">
                  <IconWallet size={18} />
                  <Text size="xs" c="dimmed">{t('profile.balance')}</Text>
                  <Text fw={700} size="lg">{profile.balance || '0.00'} {t('common.currency')}</Text>
                </div>
              </Grid.Col>
              <Grid.Col span={4}>
                <div className="profile-stat">
                  <IconGift size={18} />
                  <Text size="xs" c="dimmed">{t('profile.bonus')}</Text>
                  <Text fw={700} size="lg">{profile.bonus || '0'}</Text>
                </div>
              </Grid.Col>
              <Grid.Col span={4}>
                <div className="profile-stat">
                  <IconShieldCheck size={18} />
                  <Text size="xs" c="dimmed">{t('profile.discount')}</Text>
                  <Text fw={700} size="lg">{profile.discount ? `${profile.discount}%` : '0%'}</Text>
                </div>
              </Grid.Col>
            </Grid>
          </Grid.Col>
        </Grid>
        <Group mt="xl" className="profile-hero-actions">
          <Button leftSection={<IconCreditCard size={18} />} onClick={() => emailBlocked ? setOpenEmailModal(true) : (setPayModalAmount(forecast?.total ?? undefined), setPayModalOpen(true))}>
            {t('profile.topUp')}
          </Button>
          <Button variant="default" leftSection={<IconGift size={17} />} onClick={() => emailBlocked ? setOpenEmailModal(true) : setPromoModalOpen(true)}>
            {t('profile.enterPromo')}
          </Button>
        </Group>
      </Card>

      <section className="account-guide" aria-labelledby="account-guide-title">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={2} size="h3" id="account-guide-title">Начните с главного</Title>
            <Text size="sm" c="dimmed">Три шага, чтобы быстро настроить и начать пользоваться услугой</Text>
          </div>
          <IconListCheck size={24} color="#20d287" />
        </Group>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}><Card className="guide-step" p="md"><Text className="guide-step-number">01</Text><Text fw={700} mt="xs">Выберите услугу</Text><Text size="sm" c="dimmed" mt={4}>Откройте список услуг, выберите подходящий тариф и оформите заказ.</Text><Button variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />} mt="sm" px={0} onClick={() => navigate('/')}>К услугам</Button></Card></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}><Card className="guide-step" p="md"><Text className="guide-step-number">02</Text><Text fw={700} mt="xs">Оплатите и подключите</Text><Text size="sm" c="dimmed" mt={4}>Пополните баланс, затем откройте детали активной услуги для получения конфигурации.</Text><Button variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />} mt="sm" px={0} onClick={() => setPayModalOpen(true)}>Пополнить баланс</Button></Card></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}><Card className="guide-step" p="md"><Text className="guide-step-number">03</Text><Text fw={700} mt="xs">Защитите аккаунт</Text><Text size="sm" c="dimmed" mt={4}>Проверьте контакты и настройте пароль, 2FA или Passkey в разделе безопасности.</Text><Button variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />} mt="sm" px={0} onClick={() => document.getElementById('account-security')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Настроить защиту</Button></Card></Grid.Col>
        </Grid>
      </section>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }} style={{ display: 'flex' }}>
          <Card className="profile-section" p="lg" style={{ flex: 1 }}>
            <Group justify="space-between" mb="lg">
              <div>
                <Text fw={700}>{t('profile.personalData')}</Text>
                <Text size="xs" c="dimmed">Основная информация для вашего аккаунта</Text>
              </div>
              {!editing ? <ActionIcon variant="light" color="green" onClick={() => setEditing(true)} aria-label={t('common.edit')}><IconPencil size={16} /></ActionIcon> : null}
            </Group>
            <Stack gap="md">
              <TextInput label={t('profile.fullName')} leftSection={<IconUser size={16} />} value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} disabled={!editing} />
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}><TextInput label={t('profile.login2')} leftSection={<IconBrandTelegram size={16} />} value={formData.login2} onChange={(e) => setFormData({ ...formData, login2: e.target.value })} disabled={!editing} /></Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}><TextInput label={t('profile.phone')} leftSection={<IconPhone size={16} />} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={!editing} /></Grid.Col>
              </Grid>
              {editing && <Group justify="flex-end"><Button variant="default" size="xs" onClick={() => setEditing(false)}>{t('common.cancel')}</Button><Button size="xs" onClick={handleSave}>{t('common.save')}</Button></Group>}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }} style={{ display: 'flex' }}>
          <Card className="profile-section" p="lg" style={{ flex: 1 }}>
            <Group justify="space-between" mb="lg">
              <div><Text fw={700}>Контакты и доступ</Text><Text size="xs" c="dimmed">Привязки для восстановления и уведомлений</Text></div>
              <IconMail size={20} color="#20d287" />
            </Group>
            <Stack gap="md">
              <div className="profile-connection-row">
                <IconMail size={21} color={emailVerified ? '#20d287' : '#9aa3a3'} />
                <div style={{ flex: 1, minWidth: 0 }}>{profileEmail ? <><Text size="sm" fw={600} truncate>{profileEmail}</Text><Text size="xs" c={emailVerified ? 'green' : 'orange'}>{emailVerified ? t('profile.emailVerified') : t('profile.emailNotVerified')}</Text></> : <Text size="sm" c="dimmed">{t('profile.emailNotLinked')}</Text>}</div>
                <Button variant="default" size="xs" onClick={openEmailModal}>{profileEmail ? t('profile.change') : t('profile.link')}</Button>
              </div>
              <Divider />
              <div className="profile-connection-row">
                <IconLink size={21} color="#20d287" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    size="sm"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {partnerLink}
                  </Text>
                </div>
                <Tooltip label={clipboardLink.copied ? t('common.copied') : t('common.copy')}><ActionIcon color={clipboardLink.copied ? 'teal' : 'gray'} variant="subtle" onClick={() => clipboardLink.copy(partnerLink)}>{clipboardLink.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}</ActionIcon></Tooltip>
              </div>
              <Group justify="space-between"><Text size="xs" c="dimmed">{t('profile.id')}: {profile.user_id}</Text><Tooltip label={clipboardId.copied ? t('common.copied') : t('common.copy')}><ActionIcon size="sm" variant="subtle" onClick={() => clipboardId.copy(profile.user_id)}>{clipboardId.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}</ActionIcon></Tooltip></Group>
              {config.ALLOW_EMAIL_VERIFY === 'true' && profileEmail && !emailVerified && <Button variant="light" size="xs" color="orange" onClick={handleSendVerifyCode} loading={verifySending} disabled={resendCooldown > 0}>{resendCooldown > 0 ? `${t('profile.verify')} (${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')})` : t('profile.verify')}</Button>}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {forecast && forecast.items && forecast.items.length > 0 && (
        <Card withBorder radius="md" p="lg">
          <Group
            justify="space-between"
            style={{ cursor: 'pointer' }}
            onClick={() => setForecastOpen(!forecastOpen)}
          >
            <div>
              <Text fw={500}>{t('profile.forecast')}</Text>
              <Text size="sm" c={forecast.total > 0 ? 'red' : 'green'} fw={600}>
                {t('profile.toPay')}: {forecast.total} {t('common.currency')}
              </Text>
            </div>
            {forecastOpen ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
          </Group>
          <Collapse in={forecastOpen}>
            <Stack gap="sm" mt="md">
              {forecast.items.map((item, index) => (
                <Card
                  key={index}
                  withBorder
                  radius="sm"
                  p="sm"
                  bg={item.status === 'NOT PAID'
                    ? (colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'red.0')
                    : undefined
                  }
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>{item.name}</Text>
                        { item.qnt > 1 && (
                          <Text size="xs" c="dimmed">
                            {item.months} {t('common.months')} × {item.qnt} {t('common.pieces')}
                          </Text>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="sm" c="dimmed">
                          {item.total} {t('common.currency')}
                        </Text>
                        <Text size="xs" c={item.status === 'NOT PAID' ? 'red' : 'green'}>
                          {t(`status.${item.status}`)}
                        </Text>
                      </div>
                    </Group>
                    {item.next && (
                      <Group justify="space-between" wrap="nowrap" pt={4} style={{ borderTop: '1px dashed var(--mantine-color-default-border)' }}>
                        <div style={{ flex: 1 }}>
                          <Text size="xs" c="dimmed">{t('profile.nextRenewal')}:</Text>
                          <Text size="sm" fw={500}>{item.next.name}</Text>
                          { item.next.qnt > 1 && (
                            <Text size="xs" c="dimmed">
                              {item.next.months} {t('common.months')} × {item.next.qnt} {t('common.pieces')}
                            </Text>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={700} c="red">
                            {item.next.total} {t('common.currency')}
                          </Text>
                        </div>
                      </Group>
                    )}
                  </Stack>
                </Card>
              ))}
              {forecast.dept > 0 && (
                <Card withBorder radius="sm" p="sm" bg={colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'red.0'}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={500} c="red">{t('profile.debt')}</Text>
                    <Text size="sm" fw={700} c="red">{forecast.dept} {t('common.currency')}</Text>
                  </Group>
                </Card>
              )}
              <Button leftSection={<IconCreditCard size={18} />} onClick={() => emailBlocked ? setOpenEmailModal(true) : (setPayModalAmount(forecast?.total ?? undefined), setPayModalOpen(true))}>
                {t('profile.toPay')} {forecast.total} {t('common.currency')}
              </Button>
            </Stack>
          </Collapse>
        </Card>
      )}

      {(config.ALLOW_TELEGRAM_PIN === 'true' || hasTelegramWidget) && (
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" mb="md">
            <Text fw={500}>{t('profile.telegram')}</Text>
            {telegramLoading ? (
              <Skeleton width={100} height={24} />
            ) : telegramUsername ? (
              <Button size="xs" variant="light" color="red" onClick={() => setUnbindConfirmOpen(true)}>
                {t('profile.telegramUnbind')}
              </Button>
            ) : (
              <Button size="xs" variant="light" onClick={handleTelegramOidcBind}>
                {t('profile.telegramAuthLink')}
              </Button>
            )}
          </Group>
          <Group>
            <IconBrandTelegram size={24} color="#0088cc" />
            {telegramLoading ? (
              <Skeleton width={150} height={20} />
            ) : telegramUsername ? (
              <div>
                <Text size="sm">@{telegramUsername}</Text>
                <Text size="xs" c="dimmed">{t('profile.telegramLinked')}</Text>
              </div>
            ) : (
              <Text size="sm" c="dimmed">{t('profile.telegramNotLinked')}</Text>
            )}
          </Group>
          {telegramLoading ? (
            <Skeleton width="70%" mt={10} height={16} />
          ) : (
            <Text size="xs" c="dimmed" mt="md">
              {t('profile.telegramDescription')}
            </Text>
          )}
        </Card>
      )}

      <div id="account-security"><SecuritySettings /></div>

      <section className="account-faq" aria-labelledby="account-faq-title">
        <Group gap="xs" mb="sm"><IconHelpCircle size={22} color="#20d287" /><div><Title order={2} size="h3" id="account-faq-title">Вопросы и ответы</Title><Text size="sm" c="dimmed">Короткие ответы на основные вопросы о личном кабинете</Text></div></Group>
        <Accordion variant="separated" radius="md" className="faq-list">
          <Accordion.Item value="service"><Accordion.Control>Как начать пользоваться услугой?</Accordion.Control><Accordion.Panel>Откройте раздел «Услуги», нажмите «Заказать услугу», выберите тариф и период. После успешной оплаты услуга появится в списке со статусом «Активна».</Accordion.Panel></Accordion.Item>
          <Accordion.Item value="connect"><Accordion.Control>Где взять данные для подключения?</Accordion.Control><Accordion.Panel>Откройте нужную активную услугу и выберите вкладку «Подключение». Для VPN можно скачать конфигурацию или открыть QR-код. Для Proxy доступна ссылка подписки, QR-код и настройка в приложении.</Accordion.Panel></Accordion.Item>
          <Accordion.Item value="payment"><Accordion.Control>Как пополнить баланс и оплатить услугу?</Accordion.Control><Accordion.Panel>Нажмите «Пополнить баланс» в верхней карточке профиля. Если у услуги статус «Не оплачена», откройте ее детали, выберите платежную систему, укажите сумму и подтвердите оплату.</Accordion.Panel></Accordion.Item>
          <Accordion.Item value="manage"><Accordion.Control>Как изменить, остановить или удалить услугу?</Accordion.Control><Accordion.Panel>Откройте карточку услуги. Доступные действия отображаются в нижней части окна деталей и зависят от статуса услуги и правил тарифа.</Accordion.Panel></Accordion.Item>
          <Accordion.Item value="security"><Accordion.Control>Как защитить учетную запись?</Accordion.Control><Accordion.Panel>Привяжите актуальный email, используйте надежный пароль и включите двухфакторную аутентификацию или Passkey в разделе «Безопасность». Не передавайте конфигурации и ссылки подписки другим людям.</Accordion.Panel></Accordion.Item>
        </Accordion>
        {config.SUPPORT_LINK && <Button variant="default" leftSection={<IconHelpCircle size={17} />} mt="md" onClick={() => window.open(config.SUPPORT_LINK, '_blank')}>Связаться с поддержкой</Button>}
      </section>

      <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} initialAmount={payModalAmount} />

      <PromoModal
        opened={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        onSuccess={refreshProfile}
      />

      <Modal
        opened={telegramWaitingOpen}
        onClose={() => setTelegramWaitingOpen(false)}
        title={t('profile.telegramWaitTitle')}
        withCloseButton
        closeOnClickOutside
        closeOnEscape
      >
        <Stack gap="sm" align="center" py="sm">
          <Loader size="sm" />
          <Text size="sm" ta="center">
            {t('profile.telegramWaitDescription')}
          </Text>
        </Stack>
      </Modal>

      <Modal
        opened={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title={t('profile.linkEmail')}
        closeOnClickOutside
        closeOnEscape
        withCloseButton
      >
        <Stack gap="md">
          {profile && isValidEmail(profile.login) && (
            <Alert variant="light" color="orange" icon={<IconAlertCircle size={16} />}>
              {t('profile.emailLoginWarning')}
            </Alert>
          )}
          <TextInput
            label={t('profile.emailAddress')}
            placeholder="example@email.com"
            withAsterisk
            error={!isValidEmail(emailInput)}
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
          />
          <Text size="xs" c="dimmed">
            {t('profile.emailHint')}
          </Text>
          <Group justify="flex-end">
            <Button color="red" onClick={() => handleDeleteEmail()}  disabled={!profileEmail}>
              {t('common.delete')}
            </Button>
            <Button variant="light" onClick={() => setEmailModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveEmail} loading={emailSaving} disabled={!isValidEmail(emailInput)}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title={t('profile.verifyEmail')}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('profile.verifyEmailDescription', { email: profileEmail })}
          </Text>
          <TextInput
            label={t('profile.verifyCode')}
            placeholder="123456"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmEmail()}
            maxLength={6}
          />
          <Group justify="space-between">
            <Button
              variant="subtle"
              size="xs"
              onClick={handleSendVerifyCode}
              loading={verifySending}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `${t('profile.resendCode')} (${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')})`
                : t('profile.resendCode')}
            </Button>
            <Group gap="xs">
              <Button variant="light" onClick={() => setVerifyModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleConfirmEmail} loading={verifyConfirming}>
                {t('profile.confirmEmail')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={unbindConfirmOpen}
        onClose={() => setUnbindConfirmOpen(false)}
        title={t('common.confirmation')}
      >
        <Stack gap="md">
          <Text size="sm">
            {t('profile.telegramUnbindConfirm')}
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setUnbindConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button color="red" onClick={handleTelegramUnbind} loading={telegramLoading}>
              {t('profile.telegramUnbind')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
