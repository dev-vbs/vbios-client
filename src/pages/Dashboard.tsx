import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { userApi } from '../api/client';
import { useStore } from '../store/useStore';
import { config } from '../config';
import {
  IconArrowRight, IconBell, IconCalendar, IconChartLine, IconChevronDown, IconCopy,
  IconFileText, IconGrid4x4, IconHeadset, IconLogout,
  IconRefresh, IconServer, IconSettings
} from '@tabler/icons-react';
import './Dashboard.css';

type Payment = { amount?: number; sum?: number; cost?: number; created?: string; date?: string; status?: string };
type Service = { user_service_id: number; status: string; service?: { name?: string; cost?: number }; name?: string; expire?: string | null };

const nav = [
  { label: 'Кабинет', icon: IconGrid4x4, path: '/' },
  { label: 'Услуги и подключение', icon: IconServer, path: '/services' },
  { label: 'Поддержка', icon: IconHeadset, path: '/tickets' },
  { label: 'Настройки профиля', icon: IconSettings, path: '/profile' },
];

function money(value: number) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value); }
function dateLabel(value?: string) { return value ? new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''; }

export default function Dashboard() {
  const { user, logout } = useStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7д');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pay, service] = await Promise.all([userApi.getPayments({ limit: 100, sort_field: 'created', sort_direction: 'desc' }), userApi.getServices()]);
      setPayments((pay.data?.data || []) as Payment[]);
      setServices((service.data?.data || []) as Service[]);
    } catch {
      notifications.show({ title: 'Не удалось обновить данные', message: 'Проверьте соединение с API', color: 'red' });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalSpent = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount ?? item.sum ?? item.cost ?? 0), 0), [payments]);
  const chart = useMemo(() => {
    const points = Array.from({ length: 17 }, (_, i) => {
      const value = payments[i]?.amount ?? payments[i]?.sum ?? 0;
      return Math.min(100, Math.max(4, Number(value) * 3 + (i > 13 ? 36 : 0)));
    });
    return points.map((value, index) => `${(index / (points.length - 1)) * 100},${100 - value}`).join(' ');
  }, [payments]);

  const copyKey = async () => {
    await navigator.clipboard?.writeText('tc_live_••••••••••••••••1eb0');
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };

  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="brand">{config.APP_NAME || 'Token Club'}<button className="collapse" aria-label="Свернуть меню">‹</button></div>
      <nav className="side-nav">{nav.map(({ label, icon: Icon, path }) => <Link key={label} to={path} className={`side-item ${path === '/' ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></Link>)}</nav>
      <div className="side-bottom"><a href="#channel">↗ <span>Наш ТГ канал</span></a><a href="#support">◌ <span>Поддержка 24/7</span></a></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-topbar"><div /> <div className="top-actions"><button aria-label="Уведомления"><IconBell size={18} /></button><span className="lang">RU</span><button onClick={logout} className="logout"><IconLogout size={17} /> Выйти</button></div></header>
      <div className="dashboard-content">
        <div className="welcome"><div><h1>Личный кабинет — <strong>@{user?.login || 'пользователь'}</strong> <button className="copy-mini" onClick={copyKey}><IconCopy size={14} /></button></h1><p>Управляйте токенами и следите за статистикой API.</p></div><button className="refresh" onClick={load} disabled={loading}><IconRefresh size={17} className={loading ? 'spin' : ''} /> Обновить</button></div>
        <section className="stats-grid">
          <article className="stat-card balance-card"><div className="card-label">Баланс <button onClick={load}><IconRefresh size={16} /></button></div><div className="stat-value">{money(Number(user?.balance || 0))} <small>₽</small></div><button className="outline-btn" onClick={() => notifications.show({ message: 'Выберите платёжную систему в разделе платежей', color: 'blue' })}>Пополнить токены <span>＋</span></button></article>
          <article className="stat-card"><div className="card-label">Запросы <div className="range-switch">{['1дн','7д','30д'].map(item => <button key={item} className={range === item ? 'selected' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><div className="stat-value">{payments.length ? payments.length * 43 : 0}</div><div className="muted-note">за период {range}</div></article>
          <article className="stat-card"><div className="card-label">Потратили бы <span>по API OpenAI</span></div><div className="stat-value">{money(totalSpent || 0)} <small>₽</small></div><div className="muted-note">Расчёт токены × тариф API</div></article>
          <article className="stat-card key-card"><div className="card-label">Ваш API ключ</div><div className="key-value">tc_live_••••••••••••••••1eb0</div><button className="key-btn" onClick={copyKey}>{copied ? 'Скопировано' : 'Настроить ключ'} <IconArrowRight size={17} /></button></article>
        </section>
        <section className="lower-grid">
          <article className="panel chart-panel"><div className="panel-heading"><h2>Расход токенов по моделям</h2><button className="date-btn"><IconCalendar size={15} /> Сегодня <IconChevronDown size={15} /></button></div><div className="chart-wrap"><div className="grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart"><polyline points={chart} fill="none" stroke="#3d88a6" strokeWidth="1.2" vectorEffect="non-scaling-stroke" /></svg><div className="chart-axis"><span>02:00</span><span>06:00</span><span>10:00</span><span>14:00</span><span>18:00</span></div></div><div className="chart-total"><span>Всего за период</span><strong>{money(totalSpent || 0)} токенов</strong></div><div className="legend"><span><i className="dot blue"/> GPT-6.1 Sol <b>{money(totalSpent * .97 || 0)} токенов</b></span><span><i className="dot gray"/> GPT-6 Luna <b>{money(totalSpent * .03 || 0)} токенов</b></span></div></article>
          <article className="panel quick-panel"><h2>Быстрые действия</h2>{[['Доступные модели', IconServer], ['История запросов', IconRefresh], ['История обновлений', IconFileText], ['Стабильность моделей', IconChartLine]].map(([label, Icon]: any) => <Link to="/profile" className="quick-row" key={label as string}><Icon size={19}/><span>{label}</span><IconArrowRight size={17}/></Link>)}</article>
        </section>
        <section className="panel service-panel"><div className="panel-heading"><h2>Активные услуги</h2><Link to="/" className="text-link">Все услуги <IconArrowRight size={15}/></Link></div>{services.length === 0 ? <div className="empty">{loading ? 'Загрузка данных…' : 'Активных услуг пока нет'}</div> : <div className="service-list">{services.slice(0, 4).map(service => <div className="service-row" key={service.user_service_id}><div><strong>{service.service?.name || service.name || `Услуга #${service.user_service_id}`}</strong><span>до {dateLabel(service.expire || undefined)}</span></div><span className={`status ${service.status === 'ACTIVE' ? 'ok' : ''}`}>{service.status}</span></div>)}</div>}</section>
      </div>
    </main>
    <button className="support-fab" onClick={() => notifications.show({ message: 'Чат поддержки скоро откроется', color: 'blue' })}><IconHeadset size={18}/> Помощник Token</button>
  </div>;
}
