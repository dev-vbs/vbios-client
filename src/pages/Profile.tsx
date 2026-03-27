import { useState, useEffect, useCallback } from 'react';
import { 
  Card, Text, Stack, Group, Divider, Grid, Button, TextInput, 
  Tooltip, ActionIcon, Avatar, Modal, Loader, Center, 
  Collapse, Skeleton, useMantineColorScheme, Tabs, 
  Table, Badge, Progress, SimpleGrid, ThemeIcon, Paper, 
  Container, ScrollArea, Box
} from '@mantine/core';
import { 
  IconUser, IconPhone, IconCopy, IconBrandTelegram, 
  IconCreditCard, IconChevronDown, IconChevronUp, IconMail, 
  IconAlertCircle, IconWallet, IconHistory, IconTrendingUp, 
  IconCalendar, IconDeviceMobile, IconGift, IconServer, 
  IconRefresh, IconEye, IconEyeOff, IconQrcode, IconExternalLink,
  IconArrowDown, IconChartBar, IconChartPie, IconReceipt, 
  IconCoin, IconBuildingBank, IconDiamond, IconStar, 
  IconRocket, IconCircleCheck, IconX, IconClock, IconShare, IconDownload,
  IconPencil
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useClipboard } from '@mantine/hooks';
import { QRCodeSVG } from 'qrcode.react';
import { userApi, telegramApi, userEmailApi } from '../api/client';
import PayModal from '../components/PayModal';
import PromoModal from '../components/PromoModal';
import SecuritySettings from '../components/security/SecuritySettings';
import { useStore } from '../store/useStore';
import { config } from '../config';

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

interface Payment {
  id: number;
  amount: number;
  system: string;
  status: string;
  created_at: string;
  description?: string;
}

interface Withdrawal {
  id: number;
  amount: number;
  service_name: string;
  status: string;
  created_at: string;
  description?: string;
}

export default function Profile() {
  const { telegramPhoto, userEmail: storeEmail, userEmailVerified: storeEmailVerified, setUserEmail, setUserEmailVerified } = useStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '', login2: '' });
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [profileEmail, setProfileEmail] = useState<string | null>(storeEmail);
  const [emailVerified, setEmailVerified] = useState<number>(storeEmailVerified || 0);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyConfirming, setVerifyConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const { colorScheme } = useMantineColorScheme();
  const clipboard = useClipboard({ timeout: 1000 });
  const partnerLink = `${window.location.origin}${window.location.pathname}?partner_id=${profile?.user_id || 0}`;

  // MTProxy state
  const [mtProxy, setMtProxy] = useState({
    enabled: false,
    ip: '',
    port: '',
    secret: '',
    link: ''
  });
  const [secretVisible, setSecretVisible] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingValue, setPingValue] = useState<string>('-- ms');
  const isDark = colorScheme === 'dark';

  // Load MTProxy config from window
  useEffect(() => {
    try {
      const windowConfig = window.__APP_CONFIG__;
      if (windowConfig) {
        setMtProxy({
          enabled: windowConfig.MT_PROXY_ENABLED === 'true',
          ip: windowConfig.MT_PROXY_IP || '',
          port: windowConfig.MT_PROXY_PORT || '',
          secret: windowConfig.MT_PROXY_SECRET || '',
          link: windowConfig.MT_PROXY_LINK || ''
        });
      }
    } catch (error) {
      console.error('Failed to load MTProxy config:', error);
    }
  }, []);

  // Check proxy ping
  const checkProxyPing = useCallback(async () => {
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
        if (pingTime < 100) {
          setPingValue(`${pingTime} ms`);
        } else if (pingTime < 300) {
          setPingValue(`${pingTime} ms`);
        } else if (pingTime < 800) {
          setPingValue(`${pingTime} ms`);
        } else {
          setPingValue(`${pingTime} ms`);
        }
      } else {
        setPingValue('таймаут');
      }
    } catch (error) {
      setPingValue('ошибка');
    } finally {
      setPingLoading(false);
    }
  }, [mtProxy.enabled, mtProxy.ip, mtProxy.port]);

  // Get ping status
  const getPingStatus = useCallback(() => {
    if (pingValue === '-- ms' || pingValue === '...') return { color: 'gray', text: 'Не проверено', icon: IconClock };
    if (pingValue === 'таймаут') return { color: 'red', text: 'Таймаут', icon: IconX };
    if (pingValue === 'ошибка') return { color: 'red', text: 'Ошибка', icon: IconAlertCircle };
    
    const ms = parseInt(pingValue);
    if (ms < 100) return { color: 'green', text: 'Отлично', icon: IconCircleCheck };
    if (ms < 300) return { color: 'teal', text: 'Хорошо', icon: IconRocket };
    if (ms < 800) return { color: 'orange', text: 'Средне', icon: IconClock };
    return { color: 'red', text: 'Медленно', icon: IconAlertCircle };
  }, [pingValue]);

  // Check proxy ping on component mount if MTProxy is enabled
  useEffect(() => {
    if (mtProxy.enabled && mtProxy.ip && mtProxy.port) {
      checkProxyPing();
    }
  }, [mtProxy.enabled, mtProxy.ip, mtProxy.port, checkProxyPing]);

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

  useEffect(() => {
    setProfileEmail(storeEmail);
  }, [storeEmail]);

  useEffect(() => {
    setEmailVerified(storeEmailVerified || 0);
  }, [storeEmailVerified]);

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

  // Fetch payment history
  useEffect(() => {
    const fetchPayments = async () => {
      setPaymentsLoading(true);
      try {
        const response = await userApi.getPayments({ limit: 50 });
        const data = response.data?.data || response.data;
        
        if (data && Array.isArray(data) && data.length > 0) {
          const formattedPayments = data.map((item: any) => ({
            id: item.id,
            amount: Number(item.money) || Number(item.amount) || 0,
            system: item.pay_system_id || item.system || 'card',
            status: 'completed',
            created_at: item.date || new Date().toISOString()
          }));
          setPayments(formattedPayments);
        } else {
          setPayments([]);
        }
      } catch (error) {
        console.error('Failed to load payment history:', error);
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };

    if (profile) {
      fetchPayments();
    }
  }, [profile]);

  // Fetch withdrawal history
  useEffect(() => {
    const fetchWithdrawals = async () => {
      setWithdrawalsLoading(true);
      try {
        const response = await userApi.getWithdrawals({ limit: 50 });
        const data = response.data?.data || response.data;
        
        if (data && Array.isArray(data) && data.length > 0) {
          const formattedWithdrawals = data.map((item: any) => ({
            id: item.id,
            amount: Number(item.amount) || 0,
            service_name: item.service_name || item.name || 'Списание',
            status: item.status || 'completed',
            created_at: item.created_at || item.date || new Date().toISOString(),
            description: item.description
          }));
          setWithdrawals(formattedWithdrawals);
        } else {
          setWithdrawals([]);
        }
      } catch (error) {
        console.error('Failed to load withdrawal history:', error);
        setWithdrawals([]);
      } finally {
        setWithdrawalsLoading(false);
      }
    };

    if (profile) {
      fetchWithdrawals();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const loadExtras = async () => {
      if ( config.ALLOW_TELEGRAM_PIN === 'true') {
        setTelegramLoading(true);
        try {
          const telegramResponse = await telegramApi.getSettings();
          setTelegramUsername(telegramResponse.data.username || null);
        } catch {
        } finally {
          setTelegramLoading(false);
        }
      }
    };

    loadExtras();
  }, [profile]);

  const handleSave = async () => {
    try {
      await userApi.updateProfile(formData);
      setProfile((prev) => prev ? { ...prev, ...formData } : null);
      setEditing(false);
      notifications.show({
        title: 'Успешно',
        message: 'Профиль обновлен',
        color: 'green',
        icon: <IconCircleCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось обновить профиль',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const refreshProfile = async () => {
    const profileResponse = await userApi.getProfile();
    const profileData = profileResponse.data.data;
    const data = Array.isArray(profileData) ? profileData[0] : profileData;
    setProfile(data);
  };

  const openTelegramModal = () => {
    setTelegramInput(telegramUsername || '');
    setTelegramModalOpen(true);
  };

  const handleSaveTelegram = async () => {
    setTelegramSaving(true);
    try {
      await telegramApi.updateSettings({ username: telegramInput.trim().replace('@', '') });
      setTelegramUsername(telegramInput.trim().replace('@', '') || null);
      setTelegramModalOpen(false);
      notifications.show({
        title: 'Успешно',
        message: 'Telegram сохранен',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось сохранить Telegram',
        color: 'red',
      });
    } finally {
      setTelegramSaving(false);
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
    const errorMap: Record<string, string> = {
      'is not email': 'Некорректный email адрес',
      'Email mismatch. Use the email shown in your profile.': 'Email не совпадает с привязанным к профилю',
      'Invalid code': 'Неверный код подтверждения',
      'Code expired': 'Код подтверждения истек',
    };
    return errorMap[serverMsg] || serverMsg;
  };

  const handleSaveEmail = async () => {
    const email = emailInput.trim();

    if (email === profileEmail) {
      notifications.show({
        title: 'Ошибка',
        message: 'Email совпадает с текущим',
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
          title: 'Ошибка',
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
        title: 'Успешно',
        message: 'Email сохранен',
        color: 'green',
      });
      setEmailVerified(0);
      setUserEmailVerified(0);
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось сохранить Email',
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
        title: 'Успешно',
        message: 'Email удален',
        color: 'green',
      });
      setEmailModalOpen(false);
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось удалить Email',
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
          title: 'Ошибка',
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
        title: 'Успешно',
        message: 'Код подтверждения отправлен',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось отправить код',
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
          title: 'Ошибка',
          message: getEmailErrorMessage(data[0].msg),
          color: 'red',
        });
        return;
      }

      setEmailVerified(1);
      setUserEmailVerified(1);
      setVerifyModalOpen(false);
      notifications.show({
        title: 'Успешно',
        message: 'Email подтвержден',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось подтвердить Email',
        color: 'red',
      });
    } finally {
      setVerifyConfirming(false);
    }
  };

  const getPaymentSystemName = (system: string): string => {
    const names: Record<string, string> = {
      'card': 'Банковская карта',
      'telegram': 'Telegram Stars',
      'crypto': 'Криптовалюта',
      'sberbank': 'Сбербанк',
      'tinkoff': 'Тинькофф',
      'yoomoney': 'ЮMoney',
      'qiwi': 'QIWI',
      'other': 'Другое'
    };
    return names[system] || system;
  };

  const getPaymentSystemIcon = (system: string, size = 20) => {
    const icons: Record<string, any> = {
      'card': IconCreditCard,
      'telegram': IconBrandTelegram,
      'sberbank': IconBuildingBank,
      'tinkoff': IconBuildingBank,
      'yoomoney': IconCoin,
      'qiwi': IconReceipt,
      'other': IconWallet
    };
    const IconComponent = icons[system] || IconWallet;
    return <IconComponent size={size} />;
  };

  // Payment statistics
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const averagePayment = payments.length > 0 ? totalPayments / payments.length : 0;
  const maxPayment = payments.length > 0 ? Math.max(...payments.map(p => p.amount)) : 0;

  // Withdrawal statistics
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const averageWithdrawal = withdrawals.length > 0 ? totalWithdrawals / withdrawals.length : 0;
  const maxWithdrawal = withdrawals.length > 0 ? Math.max(...withdrawals.map(w => w.amount)) : 0;

  // Group payments by system
  const systemData: Record<string, { count: number; total: number }> = {};
  payments.forEach(p => {
    const system = p.system || 'other';
    if (!systemData[system]) {
      systemData[system] = { count: 0, total: 0 };
    }
    systemData[system].count++;
    systemData[system].total += p.amount;
  });

  // Group withdrawals by service
  const serviceData: Record<string, { count: number; total: number }> = {};
  withdrawals.forEach(w => {
    const service = w.service_name || 'other';
    if (!serviceData[service]) {
      serviceData[service] = { count: 0, total: 0 };
    }
    serviceData[service].count++;
    serviceData[service].total += w.amount;
  });

  const connectionString = mtProxy.link || `tg://proxy?server=${mtProxy.ip}&port=${mtProxy.port}&secret=${mtProxy.secret}`;
  const pingStatus = getPingStatus();
  const PingIcon = pingStatus.icon;

  if (loading || !profile) {
    return (
      <Center h="70vh">
        <Stack align="center" gap="md">
          <Loader size="xl" variant="dots" />
          <Text c="dimmed">Загрузка профиля...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box pb={40}>
      <Container size="xl">
        <Stack gap="xl">
          {/* Header with gradient */}
          <Paper
            p="xl"
            radius="xl"
            bg={isDark ? 'dark.6' : 'gradient(135deg, #667eea 0%, #764ba2 100%)'}
            style={{
              background: isDark ? undefined : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Group justify="space-between" align="center">
                <div>
                  <Group gap="md">
                    <Avatar
                      size={100}
                      radius="xl"
                      color="blue"
                      src={telegramPhoto || undefined}
                      style={{ border: '4px solid rgba(255,255,255,0.2)' }}
                    >
                      {!telegramPhoto && (profile.full_name?.charAt(0) || profile.login?.charAt(0)?.toUpperCase() || '?')}
                    </Avatar>
                    <div>
                      <Text size="xl" fw={700} c={isDark ? undefined : 'white'}>
                        {profile.full_name || profile.login || 'Пользователь'}
                      </Text>
                      <Group gap="xs" mt={4}>
                        <Badge size="lg" variant={isDark ? 'light' : 'white'} radius="xl">
                          ID: {profile.user_id}
                        </Badge>
                        {profile.discount > 0 && (
                          <Badge size="lg" color="yellow" variant={isDark ? 'light' : 'filled'} radius="xl">
                            <Group gap={4}>
                              <IconStar size={14} />
                              Скидка {profile.discount}%
                            </Group>
                          </Badge>
                        )}
                      </Group>
                    </div>
                  </Group>
                </div>
                <Button
                  variant={isDark ? 'light' : 'white'}
                  radius="xl"
                  leftSection={<IconShare size={18} />}
                  onClick={() => clipboard.copy(partnerLink)}
                >
                  Партнерская ссылка
                </Button>
              </Group>
            </div>
          </Paper>

          {/* Tabs with modern design */}
          <Card withBorder radius="xl" p={0} style={{ overflow: 'hidden' }}>
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List grow style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Tabs.Tab value="profile" leftSection={<IconUser size={18} />}>
                  Профиль
                </Tabs.Tab>
                <Tabs.Tab value="payments" leftSection={<IconWallet size={18} />}>
                  Пополнения
                  {payments.length > 0 && (
                    <Badge size="xs" color="green" ml={8} circle>
                      {payments.length}
                    </Badge>
                  )}
                </Tabs.Tab>
                <Tabs.Tab value="withdrawals" leftSection={<IconArrowDown size={18} />}>
                  Списания
                  {withdrawals.length > 0 && (
                    <Badge size="xs" color="red" ml={8} circle>
                      {withdrawals.length}
                    </Badge>
                  )}
                </Tabs.Tab>
              </Tabs.List>

              {/* Profile Tab */}
              <Tabs.Panel value="profile" pt="xl" px="lg" pb="lg">
                <Grid gutter="xl">
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card withBorder radius="xl" p="lg" h="100%">
                      <Group justify="space-between" mb="md">
                        <Group gap="xs">
                          <IconDiamond size={20} color="#22c55e" />
                          <Text fw={600} size="lg">Финансы</Text>
                        </Group>
                      </Group>
                      <Stack gap="md">
                        <Paper withBorder p="md" radius="lg" bg={isDark ? 'dark.6' : 'gray.0'}>
                          <Group justify="space-between" align="center">
                            <div>
                              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Баланс</Text>
                              <Group gap="xs" align="baseline">
                                <Text fw={800} c="cyan" style={{ fontSize: 36 }}>
                                  {profile.balance?.toFixed(2) || '0.00'}
                                </Text>
                                <Text size="sm" c="dimmed">₽</Text>
                              </Group>
                            </div>
                            <Button
                              leftSection={<IconCreditCard size={18} />}
                              color="cyan"
                              radius="xl"
                              onClick={() => setPayModalOpen(true)}
                            >
                              Пополнить
                            </Button>
                          </Group>
                        </Paper>
                        
                        <Grid>
                          <Grid.Col span={6}>
                            <Paper withBorder p="md" radius="lg">
                              <Group gap="xs" mb={8}>
                                <IconGift size={18} color="#f59e0b" />
                                <Text size="sm" fw={500}>Бонусы</Text>
                              </Group>
                              <Text fw={700} size="xl">{profile.bonus}</Text>
                              {profile.bonus < 1000 && (
                                <Progress 
                                  value={(profile.bonus / 1000) * 100} 
                                  size="sm" 
                                  color="yellow"
                                  mt={8}
                                  radius="xl"
                                />
                              )}
                              <Text size="xs" c="dimmed" mt={4}>
                                До скидки {1000 - profile.bonus} бонусов
                              </Text>
                            </Paper>
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <Paper withBorder p="md" radius="lg">
                              <Group gap="xs" mb={8}>
                                <IconStar size={18} color="#22c55e" />
                                <Text size="sm" fw={500}>Скидка</Text>
                              </Group>
                              <Text fw={700} size="xl">{profile.discount}%</Text>
                              <Text size="xs" c="dimmed" mt={4}>
                                Персональная скидка
                              </Text>
                            </Paper>
                          </Grid.Col>
                        </Grid>
                      </Stack>
                    </Card>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card withBorder radius="xl" p="lg" h="100%">
                      <Group justify="space-between" mb="md">
                        <Group gap="xs">
                          <IconUser size={20} />
                          <Text fw={600} size="lg">Личные данные</Text>
                        </Group>
                        {!editing ? (
                          <Button variant="light" size="xs" radius="xl" leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
                            Редактировать
                          </Button>
                        ) : (
                          <Group gap="xs">
                            <Button variant="light" size="xs" color="gray" onClick={() => setEditing(false)}>
                              Отмена
                            </Button>
                            <Button size="xs" onClick={handleSave}>
                              Сохранить
                            </Button>
                          </Group>
                        )}
                      </Group>
                      <Stack gap="md">
                        <TextInput
                          label="Полное имя"
                          leftSection={<IconUser size={16} />}
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          disabled={!editing}
                          radius="md"
                        />
                        <TextInput
                          label="Телефон"
                          leftSection={<IconPhone size={16} />}
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          disabled={!editing}
                          radius="md"
                        />
                        <Divider />
                        <Group justify="space-between">
                          <Text fw={500}>Email</Text>
                          <Group gap="xs">
                            {profileEmail && !emailVerified && (
                              <Button
                                variant="light"
                                size="xs"
                                color="orange"
                                onClick={handleSendVerifyCode}
                                loading={verifySending}
                                disabled={resendCooldown > 0}
                                radius="xl"
                              >
                                {resendCooldown > 0
                                  ? `${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')}`
                                  : 'Подтвердить'}
                              </Button>
                            )}
                            <Button variant="light" size="xs" onClick={openEmailModal} radius="xl">
                              {profileEmail ? 'Изменить' : 'Привязать'}
                            </Button>
                          </Group>
                        </Group>
                        <Group>
                          <IconMail size={24} color={emailVerified ? '#22c55e' : '#666'} />
                          {profileEmail ? (
                            <div>
                              <Text size="sm">{profileEmail}</Text>
                              <Text size="xs" c={emailVerified ? 'green' : 'orange'}>
                                {emailVerified ? 'Подтвержден' : 'Не подтвержден'}
                              </Text>
                            </div>
                          ) : (
                            <Text size="sm" c="dimmed">Email не привязан</Text>
                          )}
                        </Group>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>

                {/* MTProxy Block */}
                {mtProxy.enabled && mtProxy.ip && mtProxy.port && mtProxy.secret && (
                  <Card withBorder radius="xl" p="lg" mt="xl">
                    <Group justify="space-between" mb="md">
                      <Group gap="xs">
                        <IconServer size={24} color="#0088cc" />
                        <Text fw={600} size="lg">MTProxy подключение</Text>
                      </Group>
                      {mtProxy.link && (
                        <Button
                          component="a"
                          href={mtProxy.link}
                          target="_blank"
                          variant="light"
                          size="xs"
                          radius="xl"
                          leftSection={<IconExternalLink size={14} />}
                        >
                          Открыть в Telegram
                        </Button>
                      )}
                    </Group>
                    
                    <Grid>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Stack gap="sm">
                          <Paper withBorder p="sm" radius="lg">
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>Сервер:</Text>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>{mtProxy.ip}:{mtProxy.port}</Text>
                                <ActionIcon size="sm" variant="subtle" onClick={() => clipboard.copy(`${mtProxy.ip}:${mtProxy.port}`)}>
                                  <IconCopy size={14} />
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Paper>
                          <Paper withBorder p="sm" radius="lg">
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>Секрет:</Text>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                  {secretVisible ? mtProxy.secret : '••••••••••••••••••••••••••••••••'}
                                </Text>
                                <ActionIcon size="sm" variant="subtle" onClick={() => setSecretVisible(!secretVisible)}>
                                  {secretVisible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle" onClick={() => clipboard.copy(mtProxy.secret)}>
                                  <IconCopy size={14} />
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Paper>
                        </Stack>
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Paper withBorder p="sm" radius="lg">
                          <Group justify="space-between" align="center">
                            <Group gap="xs">
                              <PingIcon size={18} color={`var(--mantine-color-${pingStatus.color}-6)`} />
                              <Text size="sm" fw={500}>Пинг:</Text>
                              <Text size="sm" c={pingStatus.color} fw={600}>{pingValue}</Text>
                            </Group>
                            <Tooltip label="Проверить задержку">
                              <ActionIcon 
                                variant="light" 
                                onClick={checkProxyPing}
                                loading={pingLoading}
                              >
                                <IconRefresh size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                          <Text size="xs" c="dimmed" mt={8}>
                            Статус: {pingStatus.text}
                          </Text>
                        </Paper>
                      </Grid.Col>
                    </Grid>
                    
                    <Divider my="md" />
                    
                    <Group grow>
                      <Button
                        component="a"
                        href={mtProxy.link}
                        target="_blank"
                        leftSection={<IconBrandTelegram size={18} />}
                        variant="filled"
                        color="blue"
                        radius="xl"
                      >
                        Подключиться через Telegram
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => setQrModalOpen(true)}
                        leftSection={<IconQrcode size={18} />}
                        radius="xl"
                      >
                        Показать QR код
                      </Button>
                    </Group>
                  </Card>
                )}

                {/* Forecast Block */}
                {forecast && forecast.items && forecast.items.length > 0 && (
                  <Card withBorder radius="xl" p="lg">
                    <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => setForecastOpen(!forecastOpen)}>
                      <Group gap="xs">
                        <IconChartBar size={24} color={forecast.total > 0 ? 'red' : 'green'} />
                        <Text fw={600} size="lg">Прогноз оплаты</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" c={forecast.total > 0 ? 'red' : 'green'} fw={700}>
                          К оплате: {forecast.total} ₽
                        </Text>
                        {forecastOpen ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                      </Group>
                    </Group>
                    <Collapse in={forecastOpen}>
                      <Stack gap="sm" mt="md">
                        {forecast.items.map((item, index) => (
                          <Paper
                            key={index}
                            withBorder
                            p="sm"
                            radius="lg"
                            bg={item.status === 'NOT PAID' ? (isDark ? 'rgba(239, 68, 68, 0.1)' : 'red.0') : undefined}
                          >
                            <Group justify="space-between">
                              <div>
                                <Text fw={500}>{item.name}</Text>
                                {item.qnt > 1 && (
                                  <Text size="xs" c="dimmed">
                                    {item.months} мес. × {item.qnt} шт.
                                  </Text>
                                )}
                              </div>
                              <Text fw={700} c={item.status === 'NOT PAID' ? 'red' : 'green'}>
                                {item.total} ₽
                              </Text>
                            </Group>
                          </Paper>
                        ))}
                        <Button
                          leftSection={<IconCreditCard size={18} />}
                          onClick={() => setPayModalOpen(true)}
                          radius="xl"
                          fullWidth
                        >
                          Оплатить {forecast.total} ₽
                        </Button>
                      </Stack>
                    </Collapse>
                  </Card>
                )}

                {/* Telegram Block */}
                {config.ALLOW_TELEGRAM_PIN === 'true' && (
                  <Card withBorder radius="xl" p="lg">
                    <Group justify="space-between" mb="md">
                      <Group gap="xs">
                        <IconBrandTelegram size={24} color="#0088cc" />
                        <Text fw={600} size="lg">Telegram</Text>
                      </Group>
                      {telegramLoading ? (
                        <Skeleton width={100} height={32} radius="xl" />
                      ) : (
                        <Button variant="light" size="xs" radius="xl" onClick={openTelegramModal}>
                          {telegramUsername ? 'Изменить' : 'Привязать'}
                        </Button>
                      )}
                    </Group>
                    <Group>
                      <IconBrandTelegram size={24} color="#0088cc" />
                      {telegramLoading ? (
                        <Skeleton width={150} height={20} radius="xl" />
                      ) : telegramUsername ? (
                        <div>
                          <Text size="sm">@{telegramUsername}</Text>
                          <Text size="xs" c="dimmed">Привязан к аккаунту</Text>
                        </div>
                      ) : (
                        <Text size="sm" c="dimmed">Telegram не привязан</Text>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" mt="md">
                      Привязка Telegram позволит получать уведомления и оплачивать услуги Telegram Stars
                    </Text>
                  </Card>
                )}

                <SecuritySettings />
              </Tabs.Panel>

              {/* Payments Tab */}
              <Tabs.Panel value="payments" pt="xl" px="lg" pb="lg">
                {paymentsLoading ? (
                  <Center h={400}>
                    <Loader size="lg" />
                  </Center>
                ) : payments.length > 0 ? (
                  <Stack gap="xl">
                    {/* Statistics Cards */}
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="green" variant="light">
                            <IconWallet size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Всего пополнений</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{totalPayments.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="blue" variant="light">
                            <IconHistory size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Количество операций</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{payments.length}</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="orange" variant="light">
                            <IconTrendingUp size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Средний платёж</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{averagePayment.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="red" variant="light">
                            <IconChartBar size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Максимальный платёж</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{maxPayment.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                    </SimpleGrid>

                    {/* Payment Systems Distribution */}
                    {Object.keys(systemData).length > 0 && (
                      <Card withBorder radius="xl" p="lg">
                        <Group mb="md">
                          <IconChartPie size={24} />
                          <Text fw={600} size="lg">Распределение по платёжным системам</Text>
                        </Group>
                        <Stack gap="md">
                          {Object.entries(systemData).map(([system, data]) => {
                            const percentage = (data.total / totalPayments) * 100;
                            return (
                              <div key={system}>
                                <Group justify="space-between" mb={4}>
                                  <Group gap="xs">
                                    {getPaymentSystemIcon(system, 18)}
                                    <Text size="sm" fw={500}>{getPaymentSystemName(system)}</Text>
                                  </Group>
                                  <Text size="sm" fw={600}>{data.total.toFixed(2)} ₽ ({percentage.toFixed(1)}%)</Text>
                                </Group>
                                <Progress value={percentage} size="md" color="green" radius="xl" />
                                <Text size="xs" c="dimmed" mt={4}>{data.count} операций</Text>
                              </div>
                            );
                          })}
                        </Stack>
                      </Card>
                    )}

                    {/* Payment History Table */}
                    <Card withBorder radius="xl" p="lg">
                      <Group justify="space-between" mb="md">
                        <Group>
                          <IconReceipt size={24} />
                          <Text fw={600} size="lg">История пополнений</Text>
                        </Group>
                        <Button
                          variant="light"
                          size="xs"
                          radius="xl"
                          leftSection={<IconDownload size={14} />}
                          onClick={() => {
                            const csv = payments.map(p => 
                              `${new Date(p.created_at).toLocaleDateString('ru-RU')},${p.amount},${getPaymentSystemName(p.system)}`
                            ).join('\n');
                            const blob = new Blob(['Дата,Сумма,Система\n' + csv], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `payment_history_${profile.user_id}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            notifications.show({
                              title: 'Успешно',
                              message: 'История пополнений экспортирована',
                              color: 'green',
                            });
                          }}
                        >
                          Экспорт CSV
                        </Button>
                      </Group>
                      <ScrollArea>
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Дата</Table.Th>
                              <Table.Th>Сумма</Table.Th>
                              <Table.Th>Платёжная система</Table.Th>
                              <Table.Th>Статус</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {payments.slice(0, 10).map((payment) => (
                              <Table.Tr key={payment.id}>
                                <Table.Td>
                                  <Group gap="xs" wrap="nowrap">
                                    <IconCalendar size={14} />
                                    {new Date(payment.created_at).toLocaleDateString('ru-RU')}
                                  </Group>
                                </Table.Td>
                                <Table.Td fw={700} c="green">+{payment.amount.toFixed(2)} ₽</Table.Td>
                                <Table.Td>
                                  <Group gap="xs">
                                    {getPaymentSystemIcon(payment.system, 16)}
                                    {getPaymentSystemName(payment.system)}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Badge color="green" variant="light" radius="xl">Успешно</Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                      {payments.length > 10 && (
                        <Text size="xs" c="dimmed" mt="md" ta="center">
                          Показаны последние 10 операций из {payments.length}
                        </Text>
                      )}
                    </Card>
                  </Stack>
                ) : (
                  <Card withBorder radius="xl" p="xl" ta="center">
                    <ThemeIcon size={80} radius="xl" color="gray" variant="light" mx="auto" mb="md">
                      <IconWallet size={40} />
                    </ThemeIcon>
                    <Text size="lg" fw={600} mb="sm">Нет данных о пополнениях</Text>
                    <Text size="sm" c="dimmed" mb="md">У вас пока нет ни одного пополнения баланса</Text>
                    <Button color="cyan" radius="xl" onClick={() => setPayModalOpen(true)}>
                      Пополнить баланс
                    </Button>
                  </Card>
                )}
              </Tabs.Panel>

              {/* Withdrawals Tab */}
              <Tabs.Panel value="withdrawals" pt="xl" px="lg" pb="lg">
                {withdrawalsLoading ? (
                  <Center h={400}>
                    <Loader size="lg" />
                  </Center>
                ) : withdrawals.length > 0 ? (
                  <Stack gap="xl">
                    {/* Statistics Cards */}
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="red" variant="light">
                            <IconArrowDown size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Всего списаний</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{totalWithdrawals.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="blue" variant="light">
                            <IconHistory size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Количество операций</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{withdrawals.length}</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="orange" variant="light">
                            <IconTrendingUp size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Среднее списание</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{averageWithdrawal.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                      <Paper withBorder p="md" radius="xl">
                        <Group align="flex-start">
                          <ThemeIcon size={44} radius="xl" color="red" variant="light">
                            <IconChartBar size={24} />
                          </ThemeIcon>
                          <div>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Максимальное списание</Text>
                            <Text fw={800} style={{ fontSize: 28 }}>{maxWithdrawal.toFixed(2)} ₽</Text>
                          </div>
                        </Group>
                      </Paper>
                    </SimpleGrid>

                    {/* Services Distribution */}
                    {Object.keys(serviceData).length > 0 && (
                      <Card withBorder radius="xl" p="lg">
                        <Group mb="md">
                          <IconDeviceMobile size={24} />
                          <Text fw={600} size="lg">Распределение по услугам</Text>
                        </Group>
                        <Stack gap="md">
                          {Object.entries(serviceData).map(([service, data]) => {
                            const percentage = (data.total / totalWithdrawals) * 100;
                            return (
                              <div key={service}>
                                <Group justify="space-between" mb={4}>
                                  <Text size="sm" fw={500}>{service}</Text>
                                  <Text size="sm" fw={600}>{data.total.toFixed(2)} ₽ ({percentage.toFixed(1)}%)</Text>
                                </Group>
                                <Progress value={percentage} size="md" color="red" radius="xl" />
                                <Text size="xs" c="dimmed" mt={4}>{data.count} операций</Text>
                              </div>
                            );
                          })}
                        </Stack>
                      </Card>
                    )}

                    {/* Withdrawal History Table */}
                    <Card withBorder radius="xl" p="lg">
                      <Group justify="space-between" mb="md">
                        <Group>
                          <IconReceipt size={24} />
                          <Text fw={600} size="lg">История списаний</Text>
                        </Group>
                        <Button
                          variant="light"
                          size="xs"
                          radius="xl"
                          leftSection={<IconDownload size={14} />}
                          onClick={() => {
                            const csv = withdrawals.map(w => 
                              `${new Date(w.created_at).toLocaleDateString('ru-RU')},${w.amount},${w.service_name}`
                            ).join('\n');
                            const blob = new Blob(['Дата,Сумма,Услуга\n' + csv], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `withdrawal_history_${profile.user_id}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                            notifications.show({
                              title: 'Успешно',
                              message: 'История списаний экспортирована',
                              color: 'green',
                            });
                          }}
                        >
                          Экспорт CSV
                        </Button>
                      </Group>
                      <ScrollArea>
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Дата</Table.Th>
                              <Table.Th>Сумма</Table.Th>
                              <Table.Th>Услуга</Table.Th>
                              <Table.Th>Статус</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {withdrawals.slice(0, 10).map((withdrawal) => (
                              <Table.Tr key={withdrawal.id}>
                                <Table.Td>
                                  <Group gap="xs" wrap="nowrap">
                                    <IconCalendar size={14} />
                                    {new Date(withdrawal.created_at).toLocaleDateString('ru-RU')}
                                  </Group>
                                </Table.Td>
                                <Table.Td fw={700} c="red">-{withdrawal.amount.toFixed(2)} ₽</Table.Td>
                                <Table.Td>{withdrawal.service_name}</Table.Td>
                                <Table.Td>
                                  <Badge color="green" variant="light" radius="xl">Успешно</Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                      {withdrawals.length > 10 && (
                        <Text size="xs" c="dimmed" mt="md" ta="center">
                          Показаны последние 10 операций из {withdrawals.length}
                        </Text>
                      )}
                    </Card>
                  </Stack>
                ) : (
                  <Card withBorder radius="xl" p="xl" ta="center">
                    <ThemeIcon size={80} radius="xl" color="gray" variant="light" mx="auto" mb="md">
                      <IconArrowDown size={40} />
                    </ThemeIcon>
                    <Text size="lg" fw={600} mb="sm">Нет данных о списаниях</Text>
                    <Text size="sm" c="dimmed">У вас пока нет ни одного списания</Text>
                  </Card>
                )}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      </Container>

      {/* Modals */}
      <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} initialAmount={undefined} />
      <PromoModal opened={promoModalOpen} onClose={() => setPromoModalOpen(false)} onSuccess={refreshProfile} />

      {/* QR Modal */}
      <Modal opened={qrModalOpen} onClose={() => setQrModalOpen(false)} title="QR код для подключения" size="md" centered radius="xl">
        <Stack align="center" gap="md">
          <Card withBorder p="md" style={{ background: 'white' }} radius="xl">
            <QRCodeSVG value={connectionString} size={250} level="H" includeMargin />
          </Card>
          <Text size="sm" ta="center">Отсканируйте QR код в Telegram для быстрого подключения</Text>
          <Button variant="light" leftSection={<IconCopy size={16} />} onClick={() => {
            clipboard.copy(connectionString);
            notifications.show({ title: 'Успешно', message: 'Строка подключения скопирована', color: 'green' });
          }} fullWidth radius="xl">
            Скопировать строку подключения
          </Button>
        </Stack>
      </Modal>

      <Modal opened={telegramModalOpen} onClose={() => setTelegramModalOpen(false)} title="Привязать Telegram" radius="xl">
        <Stack gap="md">
          <TextInput
            label="Telegram логин"
            placeholder="@username"
            value={telegramInput}
            onChange={(e) => setTelegramInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTelegram()}
            radius="md"
          />
          <Text size="xs" c="dimmed">Введите ваш Telegram логин (без @)</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setTelegramModalOpen(false)} radius="xl">Отмена</Button>
            <Button onClick={handleSaveTelegram} loading={telegramSaving} radius="xl">Сохранить</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Привязать Email" radius="xl">
        <Stack gap="md">
          <TextInput
            label="Email адрес"
            placeholder="example@email.com"
            withAsterisk
            error={!isValidEmail(emailInput)}
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            radius="md"
          />
          <Group justify="flex-end">
            <Button color="red" onClick={handleDeleteEmail} disabled={!profileEmail} radius="xl">Удалить</Button>
            <Button variant="light" onClick={() => setEmailModalOpen(false)} radius="xl">Отмена</Button>
            <Button onClick={handleSaveEmail} loading={emailSaving} disabled={!isValidEmail(emailInput)} radius="xl">Сохранить</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} title="Подтверждение Email" radius="xl">
        <Stack gap="md">
          <Text size="sm">Код подтверждения отправлен на {profileEmail}</Text>
          <TextInput
            label="Код подтверждения"
            placeholder="123456"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength={6}
            radius="md"
          />
          <Group justify="space-between">
            <Button variant="subtle" size="xs" onClick={handleSendVerifyCode} loading={verifySending} disabled={resendCooldown > 0} radius="xl">
              {resendCooldown > 0 ? `Отправить повторно (${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')})` : 'Отправить повторно'}
            </Button>
            <Group gap="xs">
              <Button variant="light" onClick={() => setVerifyModalOpen(false)} radius="xl">Отмена</Button>
              <Button onClick={handleConfirmEmail} loading={verifyConfirming} radius="xl">Подтвердить</Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
