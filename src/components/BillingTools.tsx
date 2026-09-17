import { useEffect, useState } from 'react';
import { Button, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { IconRefresh, IconTrash, IconUsers } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { userApi } from '../api/client';

type Autopayment = { pay_system?: string; name?: string; title?: string };

export default function BillingTools() {
  const [autopayments, setAutopayments] = useState<Autopayment[]>([]);
  const [referrals, setReferrals] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const [auto, refs] = await Promise.all([userApi.getAutopayments(), userApi.getReferrals()]); setAutopayments(auto.data.data || []); setReferrals(refs.data.data || []); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const remove = async (paySystem?: string) => { if (!paySystem) return; try { await userApi.deleteAutopayment(paySystem); await load(); notifications.show({ color: 'green', message: 'Автоплатёж удалён' }); } catch { notifications.show({ color: 'red', message: 'Не удалось удалить автоплатёж' }); } };
  return <Card withBorder radius="md" p="lg"><Group justify="space-between" mb="md"><Text fw={700}>Платежи и партнёрская программа</Text><Button size="xs" variant="light" leftSection={<IconRefresh size={15} />} onClick={load} loading={loading}>Обновить</Button></Group>{loading ? <Loader size="sm" /> : <Stack gap="md"><Stack gap={4}><Text fw={600} size="sm">Автоплатежи</Text>{autopayments.length ? autopayments.map((item, index) => <Group key={`${item.pay_system}-${index}`} justify="space-between"><Text size="sm">{item.name || item.title || item.pay_system || 'Способ оплаты'}</Text><Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14} />} onClick={() => remove(item.pay_system)}>Удалить</Button></Group>) : <Text size="sm" c="dimmed">Подключённых автоплатежей нет.</Text>}</Stack><Stack gap={2}><Group gap="xs"><IconUsers size={17} /><Text fw={600} size="sm">Рефералы</Text></Group><Text size="sm" c="dimmed">Приглашено пользователей: {referrals.length}</Text></Stack></Stack>}</Card>;
}
