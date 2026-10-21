import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconHeadset, IconLogout, IconServer, IconSettings, IconSparkles } from '@tabler/icons-react';
import { config } from '../config';
import { useStore } from '../store/useStore';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { LegalLinks } from './LegalLinks';
import '../pages/Dashboard.css';

type Props = { children: ReactNode };

const items = [
  { path: '/', label: 'Обзор', icon: IconSparkles },
  { path: '/services', label: 'Мои услуги', icon: IconServer },
  { path: '/tickets', label: 'Поддержка', icon: IconHeadset },
  { path: '/profile', label: 'Профиль', icon: IconSettings },
];

export function CabinetLayout({ children }: Props) {
  const location = useLocation();
  const { logout } = useStore();
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="cabinet-shell">
      <aside className="cabinet-sidebar">
        <Link className="cabinet-brand" to="/">{config.APP_NAME || 'SHM'}<span>.</span></Link>
        <p className="cabinet-caption">Личный кабинет</p>
        <nav className="cabinet-nav" aria-label="Основная навигация">
          {items.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} className={`cabinet-nav-item ${isActive(path) ? 'is-active' : ''}`}>
              <Icon size={19} stroke={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="cabinet-sidebar-footer"><div className="cabinet-sidebar-tools"><LanguageSwitcher /><ThemeToggle /></div>
          {config.SUPPORT_LINK ? <a href={config.SUPPORT_LINK} target="_blank" rel="noreferrer"><IconHeadset size={17} />Нужна помощь?</a> : <Link to="/tickets"><IconHeadset size={17} />Нужна помощь?</Link>}
          <button type="button" onClick={logout}><IconLogout size={17} />Выйти</button>
        </div>
      </aside>
      <main className="cabinet-main cabinet-page-main">{children}<LegalLinks /></main>
    </div>
  );
}
