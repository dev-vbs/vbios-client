import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight, IconCreditCard } from '@tabler/icons-react';
import PayModal from '../components/PayModal';
import PromoModal from '../components/PromoModal';
import PayHistoryModal from '../components/PayHistoryModal';
import WithdrawHistoryModal from '../components/WithdrawHistoryModal';
import { useStore } from '../store/useStore';
export function BalancePage() {
  const user = useStore(s => s.user);
  const [pay, setPay] = useState(false);
  const [promo, setPromo] = useState(false);
  return <Stack gap="xl" className="vpn-finance"><header><Title order={1}>Баланс и оплата</Title><Text c="dimmed" mt="sm">Пополните баланс для подключения и продления VPN.</Text></header><section className="vpn-finance-panel"><Text c="dimmed" size="sm">Доступно на балансе</Text><Text size="36px" fw={750} mt={6}>{new Intl.NumberFormat('ru-RU').format(Number(user?.balance || 0))} ₽</Text><Text c="dimmed" size="sm" mt={6}>Бонусы: {Number(user?.bonus || 0)} ₽</Text><Group mt="xl"><Button leftSection={<IconCreditCard size={18} />} size="md" onClick={() => setPay(true)}>Пополнить баланс</Button><Button variant="default" size="md" onClick={() => setPromo(true)}>Есть промокод</Button></Group><div className="vpn-guidance" style={{ marginTop: 24 }}>В форме оплаты выберите сумму и доступный способ пополнения. После зачисления вернитесь в «Мой VPN» и выберите тариф.</div></section><Button component={Link} to="/services?order=1" variant="light" rightSection={<IconArrowRight size={18} />} style={{ alignSelf: 'flex-start' }}>Выбрать тариф VPN</Button><PayModal opened={pay} onClose={() => setPay(false)} /><PromoModal opened={promo} onClose={() => setPromo(false)} /></Stack>;
}
export function OperationsPage() {
  const [payments, setPayments] = useState(false);
  const [withdrawals, setWithdrawals] = useState(false);
  return <Stack gap="xl"><header><Title order={1}>История операций</Title><Text c="dimmed" mt="sm">Пополнения и списания по вашему аккаунту.</Text></header><section className="vpn-finance-panel"><Title order={2}>Движение средств</Title><Text c="dimmed" mt="sm">Откройте историю пополнений или списаний. В таблице доступны суммы и даты операций.</Text><Group mt="xl"><Button onClick={() => setPayments(true)}>Пополнения баланса</Button><Button variant="default" onClick={() => setWithdrawals(true)}>Списания за услуги</Button></Group></section><PayHistoryModal opened={payments} onClose={() => setPayments(false)} /><WithdrawHistoryModal opened={withdrawals} onClose={() => setWithdrawals(false)} /></Stack>;
}
