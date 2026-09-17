import { useEffect, useState } from 'react';
import { Alert, Card, Group, Loader, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconCalendarDue, IconServer, IconWallet } from '@tabler/icons-react';
import { userApi } from '../api/client';
import { useStore } from '../store/useStore';

type Service = { status: string; expire?: string | null; service?: { name?: string } };

export default function Overview() {
  const { user } = useStore();
  const [services, setServices] = useState<Service[]>([]);
  const [toPay, setToPay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([userApi.getServices(), userApi.getForecast()]).then(([serviceResponse, forecastResponse]) => { setServices(serviceResponse.data.data || []); const forecast = Array.isArray(forecastResponse.data.data) ? forecastResponse.data.data[0] : forecastResponse.data.data; setToPay(Number(forecast?.total || 0)); }).finally(() => setLoading(false)); }, []);
  if (loading) return <Stack align="center" py={80}><Loader size="lg" /></Stack>;
  const active = services.filter((service) => service.status === 'ACTIVE');
  const expiring = active.filter((service) => service.expire && new Date(service.expire).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000);
  const nearest = expiring.sort((a, b) => new Date(a.expire || 0).getTime() - new Date(b.expire || 0).getTime())[0];
  return <Stack gap="lg" className="overview-workspace"><Stack gap={2}><Title order={2}>Обзор кабинета</Title><Text c="dimmed">Баланс, услуги и важные события в одном месте</Text></Stack><SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md"><Card withBorder><Group><ThemeIcon color="cyan" variant="light" size="lg"><IconWallet size={20} /></ThemeIcon><Stack gap={0}><Text size="xs" c="dimmed">Баланс</Text><Text fw={750} size="xl">{user?.balance ?? 0} ₽</Text></Stack></Group></Card><Card withBorder><Group><ThemeIcon color="green" variant="light" size="lg"><IconServer size={20} /></ThemeIcon><Stack gap={0}><Text size="xs" c="dimmed">Активных услуг</Text><Text fw={750} size="xl">{active.length}</Text></Stack></Group></Card><Card withBorder><Group><ThemeIcon color={toPay ? 'orange' : 'cyan'} variant="light" size="lg"><IconCalendarDue size={20} /></ThemeIcon><Stack gap={0}><Text size="xs" c="dimmed">Ближайшее списание</Text><Text fw={750} size="xl">{toPay ? `${toPay} ₽` : 'Нет'}</Text></Stack></Group></Card></SimpleGrid>{nearest && <Alert icon={<IconAlertTriangle size={18} />} color="orange" variant="light" title="Скоро закончится услуга"><Text size="sm">{nearest.service?.name || 'Услуга'} действует до {new Date(nearest.expire || '').toLocaleDateString('ru-RU')}. Проверьте баланс для продления.</Text></Alert>}<Card withBorder><Text fw={700}>Уведомления</Text><Text size="sm" c="dimmed">Важные события формируются по данным кабинета. Push-уведомления включаются кнопкой с колокольчиком в верхнем меню.</Text></Card></Stack>;
}
