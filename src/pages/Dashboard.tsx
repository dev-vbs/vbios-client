import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { userApi } from '../api/client';
import { useStore } from '../store/useStore';
import { IconArrowRight, IconCalendarEvent, IconCircleCheck, IconCreditCard, IconRefresh, IconServer, IconShieldCheck, IconWallet } from '@tabler/icons-react';
import PayModal from '../components/PayModal';
import './Dashboard.css';

type Payment = { amount?: number; sum?: number; cost?: number; created?: string; date?: string };
type Service = { user_service_id: number; status?: string; service?: { name?: string }; name?: string; expire?: string | null };
type Forecast = { total?: number; dept?: number };
const rubles = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'не указана';
const paymentAmount = (payment: Payment) => Number(payment.amount ?? payment.sum ?? payment.cost ?? 0);

export default function Dashboard() {
  const { user } = useStore();
  const [services, setServices] = useState<Service[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const [servicesResult, paymentsResult, forecastResult] = await Promise.allSettled([userApi.getServices(), userApi.getPayments({ limit: 5, sort_field: 'created', sort_direction: 'desc' }), userApi.getForecast()]);
    if (servicesResult.status === 'fulfilled') setServices((servicesResult.value.data?.data || []) as Service[]);
    if (paymentsResult.status === 'fulfilled') setPayments((paymentsResult.value.data?.data || []) as Payment[]);
    if (forecastResult.status === 'fulfilled') { const data = forecastResult.value.data?.data; setForecast(Array.isArray(data) ? data[0] : data); }
    if (servicesResult.status === 'rejected') notifications.show({ title: 'Не удалось обновить кабинет', message: 'Проверьте соединение с сервером и повторите попытку.', color: 'red' });
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const activeServices = useMemo(() => services.filter((service) => service.status === 'ACTIVE' || service.status === 'active'), [services]);
  const hasBalance = Number(user?.balance || 0) > 0;
  return <><header className="cabinet-header"><div><span className="cabinet-breadcrumb">Личный кабинет</span><h1>Добрый день, {user?.full_name || user?.login || 'пользователь'}</h1></div><button type="button" className="refresh-button" onClick={() => void load()} disabled={loading}><IconRefresh className={loading ? 'spin' : ''} size={17} />Обновить</button></header>
      <section className="cabinet-hero"><div className="hero-copy"><div className="hero-icon"><IconShieldCheck size={26} /></div><div><h2>Ваше подключение под контролем</h2><p>{activeServices.length ? `Активных услуг: ${activeServices.length}. Откройте услугу, чтобы подключить устройства или изменить тариф.` : 'Выберите подходящую услугу, чтобы получить безопасное подключение.'}</p></div></div><Link className="hero-action" to="/services">{activeServices.length ? 'Открыть подключения' : 'Выбрать услугу'}<IconArrowRight size={18} /></Link></section>
      <section className="cabinet-summary"><article className="summary-card balance-summary"><span className="summary-label"><IconWallet size={17} />Баланс</span><strong>{rubles(Number(user?.balance || 0))} <small>₽</small></strong><p>{hasBalance ? 'Средства доступны для продления услуг.' : 'Пополните баланс для оплаты и продления услуг.'}</p><button type="button" onClick={() => setPayModalOpen(true)}>Пополнить баланс <IconArrowRight size={17} /></button></article><article className="summary-card"><span className="summary-label"><IconServer size={17} />Услуги</span><strong>{activeServices.length}</strong><p>{activeServices.length ? 'подключений активно сейчас' : 'активных подключений пока нет'}</p><Link to="/services">Управлять услугами <IconArrowRight size={17} /></Link></article><article className="summary-card"><span className="summary-label"><IconCalendarEvent size={17} />К оплате</span><strong>{rubles(Number(forecast?.total || 0))} <small>₽</small></strong><p>{forecast?.dept ? `Есть задолженность: ${rubles(Number(forecast.dept))} ₽` : 'Ближайшие продления и платежи'}</p><Link to="/profile">Посмотреть детали <IconArrowRight size={17} /></Link></article></section>
      <section className="cabinet-grid"><article className="cabinet-panel services-panel"><div className="panel-title"><div><h2>Мои подключения</h2><p>Статус услуг и быстрый доступ к настройке.</p></div><Link to="/services">Все услуги <IconArrowRight size={16} /></Link></div>{loading ? <div className="panel-placeholder">Загружаем данные…</div> : activeServices.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><IconServer size={24} /></div><h3>Подключений пока нет</h3><p>Оформите услугу — ссылка на подключение и инструкции появятся здесь.</p><Link to="/services">Перейти к услугам <IconArrowRight size={17} /></Link></div> : <div className="connection-list">{activeServices.slice(0, 4).map((service) => <div className="connection-row" key={service.user_service_id}><div className="connection-status"><IconCircleCheck size={18} /></div><div className="connection-name"><strong>{service.service?.name || service.name || `Услуга #${service.user_service_id}`}</strong><span>Продление до {formatDate(service.expire)}</span></div><span className="status-live">Активна</span><Link aria-label="Открыть услугу" to="/services"><IconArrowRight size={18} /></Link></div>)}</div>}</article><article className="cabinet-panel help-panel"><div className="panel-title"><div><h2>С чего начать</h2><p>Подключение займёт несколько минут.</p></div></div><ol className="start-steps"><li><span>1</span><div><strong>Откройте услугу</strong><p>Выберите активное подключение в разделе «Мои услуги».</p></div></li><li><span>2</span><div><strong>Добавьте подписку</strong><p>Скопируйте ссылку или отсканируйте QR-код в HAPP, INCY или v2ray.</p></div></li><li><span>3</span><div><strong>Проверьте подключение</strong><p>Следуйте инструкции в карточке услуги.</p></div></li></ol><Link className="help-link" to="/services">Инструкции по подключению <IconArrowRight size={17} /></Link></article></section>
      <section className="cabinet-panel payments-panel"><div className="panel-title"><div><h2>Последние платежи</h2><p>Операции по вашему аккаунту.</p></div><Link to="/profile">История платежей <IconArrowRight size={16} /></Link></div>{payments.length === 0 ? <div className="panel-placeholder">История платежей появится после первого пополнения.</div> : <div className="payment-list">{payments.map((payment, index) => <div className="payment-row" key={`${payment.created || payment.date || index}-${index}`}><div className="payment-icon"><IconCreditCard size={18} /></div><div><strong>Пополнение баланса</strong><span>{formatDate(payment.created || payment.date)}</span></div><b>+{rubles(paymentAmount(payment))} ₽</b></div>)}</div>}</section>
    <PayModal opened={payModalOpen} onClose={() => setPayModalOpen(false)} /></>;
}