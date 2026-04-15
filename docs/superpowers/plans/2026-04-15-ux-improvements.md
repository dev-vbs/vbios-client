# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Упростить UX клиентского кабинета SHM: (1) добавить настраиваемый режим «моно-услуги», (2) вынести быстрые действия по подписке на карточку, (3) упростить навигацию (Платежи/Списания перенести в Профиль).

**Architecture:** Все новые правила управляются через runtime-конфиг (`window.__APP_CONFIG__` / `import.meta.env.VITE_*`), чтобы операторы могли включать/выключать каждую фичу независимо. Новые хелперы выносим в `src/utils/services.ts`, устраняя дублирование `normalizeCategory` между `Services.tsx` и `OrderServiceModal.tsx`. UI-изменения локализованы через i18next (ru/en).

**Tech Stack:** React 19, TypeScript 5.9, Mantine 8, React Router 7, i18next, Vite 7.

## Testing approach

В проекте **нет юнит-тест-фреймворка** (Jest/Vitest не установлены, CI их не запускает). Поэтому каждая задача верифицируется:

1. `npm run lint` — без новых ошибок
2. `npm run build` — TypeScript + Vite-сборка проходит
3. **Ручная проверка в браузере** (`npm run dev`) по сценариям, описанным в каждой задаче

Не добавляем тестовый фреймворк в рамках этого плана — это отдельная инициатива.

## Обратная совместимость

Все новые флаги имеют значения по умолчанию, сохраняющие текущее поведение:

- `MONO_SERVICE_ENABLE = 'false'` (по умолчанию выкл)
- `MONO_SERVICE_CATEGORIES = ''` (если режим включён, но список пуст — ограничение на все категории)
- `SHOW_CARD_QUICK_ACTIONS = 'true'` (новые иконки видны; операторы могут отключить)
- `NAV_PAYMENTS_IN_PROFILE = 'false'` (по умолчанию поведение старое — Payments/Withdrawals в меню)

---

## Phase 1 — Mono-service mode

Ограничить заказ дополнительных услуг при наличии активной подписки. Включается через конфиг, поддерживает как глобальный режим, так и список категорий.

### Task 1: Config flags for mono-service

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Добавить поля в интерфейс `AppConfig`**

В `src/config.ts` в блок `interface AppConfig` (после `ORDER_SORTING: string;` на строке 65) добавить:

```ts
  MONO_SERVICE_ENABLE: string;
  MONO_SERVICE_CATEGORIES: string;
  MONO_SERVICE_STATUSES: string;
```

- [ ] **Step 2: Добавить чтение из runtime/env в `getConfig()`**

В объекте, возвращаемом из `getConfig()` (после строки с `CAPTCHA_ENABLED`, перед `};`), добавить три строки:

```ts
    MONO_SERVICE_ENABLE: runtimeConfig?.MONO_SERVICE_ENABLE || import.meta.env.VITE_MONO_SERVICE_ENABLE || 'false',
    MONO_SERVICE_CATEGORIES: runtimeConfig?.MONO_SERVICE_CATEGORIES || import.meta.env.VITE_MONO_SERVICE_CATEGORIES || '',
    MONO_SERVICE_STATUSES: runtimeConfig?.MONO_SERVICE_STATUSES || import.meta.env.VITE_MONO_SERVICE_STATUSES || 'ACTIVE,NOT PAID,PROGRESS',
```

Пояснения:
- `MONO_SERVICE_ENABLE` — главный выключатель (`'true'`/`'false'`).
- `MONO_SERVICE_CATEGORIES` — CSV с нормализованными именами категорий (`vpn,proxy`). Пусто + включено = правило на все категории.
- `MONO_SERVICE_STATUSES` — какие статусы считать «занимающими слот». По умолчанию: ACTIVE, NOT PAID, PROGRESS.

- [ ] **Step 3: Verify**

Выполнить:
```bash
npm run lint && npm run build
```
Ожидаемо: обе команды проходят без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add mono-service feature flags"
```

---

### Task 2: Shared utilities for categories & mono-service checks

**Files:**
- Create: `src/utils/services.ts`

- [ ] **Step 1: Создать `src/utils/services.ts`**

```ts
import { config } from '../config';

export interface UserServiceLike {
  status: string;
  service: { category: string };
  children?: UserServiceLike[];
}

/**
 * Нормализует сырую категорию в канонический идентификатор (vpn/proxy/<raw>).
 * Единственный источник истины — ранее этот код был продублирован в Services.tsx и OrderServiceModal.tsx.
 */
export function normalizeCategory(category: string): string {
  const proxyCategories = new Set(
    config.PROXY_CATEGORY.split(',').map((c) => c.trim()).filter(Boolean)
  );
  const vpnCategories = new Set(
    config.VPN_CATEGORY.split(',').map((c) => c.trim()).filter(Boolean)
  );

  if (proxyCategories.has(category)) return 'proxy';
  if (vpnCategories.has(category)) return 'vpn';

  if (/remna|remnawave|marzban|marz|mz/i.test(category)) return 'proxy';
  if (/^(vpn|wg|awg)/i.test(category)) return 'vpn';

  if (['web_tariff', 'web', 'mysql', 'mail', 'hosting'].includes(category)) {
    return category;
  }
  return 'other';
}

/**
 * Плоский список всех услуг пользователя (включая children).
 */
export function flattenServices<T extends UserServiceLike>(list: T[]): T[] {
  const out: T[] = [];
  const walk = (items: T[]) => {
    for (const s of items) {
      out.push(s);
      if (s.children && s.children.length) walk(s.children as T[]);
    }
  };
  walk(list);
  return out;
}

/**
 * Вычисленные настройки моно-режима из config.
 */
export function getMonoServiceSettings() {
  const enabled = config.MONO_SERVICE_ENABLE === 'true';
  const categories = config.MONO_SERVICE_CATEGORIES
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const statuses = new Set(
    config.MONO_SERVICE_STATUSES
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return { enabled, categories, statuses };
}

/**
 * Считается ли услуга «занимающей слот» по моно-правилу.
 */
export function isOccupyingService(
  status: string,
  statuses: Set<string>
): boolean {
  return statuses.has(status);
}

/**
 * Возвращает список категорий (нормализованных), по которым у пользователя
 * уже есть занимающая слот услуга. Используется UI для блокировки заказа.
 */
export function getOccupiedCategories(
  services: UserServiceLike[]
): Set<string> {
  const { statuses } = getMonoServiceSettings();
  const occupied = new Set<string>();
  for (const s of flattenServices(services)) {
    if (isOccupyingService(s.status, statuses)) {
      occupied.add(normalizeCategory(s.service.category));
    }
  }
  return occupied;
}

/**
 * Применяется ли моно-правило к данной категории.
 * - enabled=false → никогда
 * - categories пусто → ко всем
 * - иначе → только к перечисленным
 */
export function isMonoApplicable(normalizedCategory: string): boolean {
  const { enabled, categories } = getMonoServiceSettings();
  if (!enabled) return false;
  if (categories.length === 0) return true;
  return categories.includes(normalizedCategory.toLowerCase());
}

/**
 * Есть ли у пользователя хотя бы одна «занятая» услуга, на которую действует моно-режим.
 */
export function hasMonoBlockingService(services: UserServiceLike[]): boolean {
  const occupied = getOccupiedCategories(services);
  for (const cat of occupied) {
    if (isMonoApplicable(cat)) return true;
  }
  return false;
}
```

- [ ] **Step 2: Verify**

```bash
npm run lint && npm run build
```
Ожидаемо: проходит.

- [ ] **Step 3: Commit**

```bash
git add src/utils/services.ts
git commit -m "feat(utils): add shared service helpers and mono-service checks"
```

---

### Task 3: Wire mono-service check into Services page

**Files:**
- Modify: `src/pages/Services.tsx` (удаление локального `normalizeCategory`, импорт из utils, использование моно-хелперов в CTA)

- [ ] **Step 1: Заменить локальный `normalizeCategory` на импорт**

В `src/pages/Services.tsx`:

Удалить весь блок функции `normalizeCategory` (строки 63–84).

В верхних импортах (после строки 15 `import { isTelegramWebApp } from '../constants/webapp';`) добавить:

```ts
import {
  normalizeCategory,
  getOccupiedCategories,
  isMonoApplicable,
  hasMonoBlockingService,
} from '../utils/services';
```

- [ ] **Step 2: Превратить кнопку «Заказать» в «Сменить тариф», когда моно-режим блокирует заказ**

В функции `Services()` (после вычисления `groupedServices`, прямо перед блоком `if (loading) { ... }` около строки 944) добавить:

```ts
  const monoBlocks = hasMonoBlockingService(services);

  const handlePrimaryCta = () => {
    if (config.EMAIL_VERIFY_REQUIRED === 'true' && !userEmailVerified) {
      setConfirmEmailNotVerified(true);
      return;
    }
    if (monoBlocks) {
      // Находим первую «занятую» услугу под моно-правилом и открываем смену тарифа.
      const occupied = getOccupiedCategories(services);
      const target = services.find((s) => {
        const cat = normalizeCategory(s.service.category);
        return occupied.has(cat) && isMonoApplicable(cat);
      });
      if (target) {
        setChangeService(target);
        openChangeModal();
        return;
      }
    }
    openOrderModal();
  };
```

Заменить обе кнопки «Order Service» (строки 957 и 971) с inline-проверки email на `onClick={handlePrimaryCta}` и динамическую надпись:

```tsx
<Button
  leftSection={<IconPlus size={16} />}
  onClick={handlePrimaryCta}
>
  {monoBlocks ? t('services.changeService') : t('services.orderService')}
</Button>
```

(сделать то же для второй кнопки в пустом состоянии — строки 971-973).

- [ ] **Step 3: Показать info-баннер в начале страницы при активной блокировке**

В рендере `Services()` сразу после `<Group justify="space-between">...</Group>` с заголовком (т.е. после закрывающего `</Group>` на строке ~963, перед проверкой `Object.keys(groupedServices).length === 0`) добавить:

```tsx
{monoBlocks && (
  <Alert
    icon={<IconInfoCircle size={16} />}
    color="blue"
    variant="light"
    radius="md"
  >
    {t('services.monoServiceNotice')}
  </Alert>
)}
```

Добавить к импорту из `@mantine/core` (строка 3) элемент `Alert`, и к импорту из `@tabler/icons-react` (строка 4) — `IconInfoCircle`.

- [ ] **Step 4: Verify (ручная проверка)**

```bash
npm run lint && npm run build && npm run dev
```

Сценарии в браузере:
- `MONO_SERVICE_ENABLE=false` (по умолчанию): на главной кнопка «Заказать услугу», клик открывает каталог. **Без регрессии.**
- `MONO_SERVICE_ENABLE=true`, нет активных услуг: кнопка «Заказать услугу», каталог открывается, баннер не показывается.
- `MONO_SERVICE_ENABLE=true`, есть услуга со статусом `ACTIVE`: кнопка меняется на «Сменить тариф», показывается баннер, клик открывает `OrderServiceModal` в режиме `change` с текущей услугой.
- `MONO_SERVICE_ENABLE=true`, `MONO_SERVICE_CATEGORIES=proxy`, активна `vpn`: кнопка остаётся «Заказать услугу», баннера нет.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Services.tsx
git commit -m "feat(services): convert Order CTA to Change when mono-service blocks"
```

---

### Task 4: Apply mono-service rule inside OrderServiceModal

**Files:**
- Modify: `src/components/OrderServiceModal.tsx`

- [ ] **Step 1: Передать список услуг пользователя в модалку**

В `src/pages/Services.tsx` в обоих рендерах `<OrderServiceModal ... />` (около строк 1054 и 1063) добавить пропс:

```tsx
userServices={services}
```

В `src/components/OrderServiceModal.tsx` расширить `OrderServiceModalProps` (строки 28-41):

```ts
interface OrderServiceModalProps {
  opened: boolean;
  onClose: () => void;
  onOrderSuccess?: () => void;
  mode?: 'order' | 'change';
  currentService?: {
    user_service_id: number;
    service_id: number;
    status: string;
    category: string;
    name?: string;
  };
  onChangeSuccess?: () => void;
  userServices?: Array<{
    status: string;
    service: { category: string };
    children?: Array<{ status: string; service: { category: string } }>;
  }>;
}
```

И деструктурировать `userServices = []` в сигнатуре `OrderServiceModal`:

```ts
export default function OrderServiceModal({
  opened,
  onClose,
  onOrderSuccess,
  mode = 'order',
  currentService,
  onChangeSuccess,
  userServices = [],
}: OrderServiceModalProps) {
```

- [ ] **Step 2: Заменить локальный `normalizeCategory` на импорт**

В `src/components/OrderServiceModal.tsx`:

Удалить локальную функцию `normalizeCategory` (строки 43-54).

В импортах добавить:

```ts
import { normalizeCategory, getOccupiedCategories, isMonoApplicable } from '../utils/services';
```

- [ ] **Step 3: Фильтровать предложения каталога по моно-правилу**

Внутри компонента после строки `const isChangeMode = mode === 'change';` (~строка 96) добавить:

```ts
  const occupiedCategories = getOccupiedCategories(userServices);
  const isServiceBlockedByMono = (rawCategory: string): boolean => {
    if (isChangeMode) return false;
    const cat = normalizeCategory(rawCategory);
    if (!isMonoApplicable(cat)) return false;
    // Если категория занята — услуги этой же категории (для смены) не блокируем в order-режиме,
    // потому что order-режим = новый заказ, а для смены UI переключится сам.
    return occupiedCategories.size > 0;
  };
```

В рендере каталога услуг (в `groupedServices` reduce, строка ~348 и далее, где строится `acc[category].services.push(service)`) добавить пометку к каждой услуге: если `isServiceBlockedByMono(service.category)` — делать её карточку неактивной (Mantine `Card` с `opacity: 0.5`, `pointerEvents: 'none'`) и показывать иконку-замок с Tooltip `t('order.blockedByMono')`.

Конкретно найти блок, где рендерится карточка услуги внутри `groupedServices` (это отдельный map в JSX после строки 400+), и обернуть/модифицировать:

```tsx
{group.services.map((service) => {
  const blocked = isServiceBlockedByMono(service.category);
  return (
    <Tooltip
      key={service.service_id}
      label={t('order.blockedByMono')}
      disabled={!blocked}
      withArrow
    >
      <Card
        withBorder
        radius="md"
        p="md"
        onClick={blocked ? undefined : () => setSelectedService(service)}
        style={{
          cursor: blocked ? 'not-allowed' : 'pointer',
          opacity: blocked ? 0.5 : 1,
        }}
      >
        {/* существующее содержимое карточки */}
      </Card>
    </Tooltip>
  );
})}
```

> **Note to implementer:** точная структура JSX вокруг карточки услуги в `OrderServiceModal.tsx` — прочитай текущий рендер (от `services.map` / `groupedServices.entries()` внутри компонента) и внеси правку, сохранив существующую разметку содержимого карточки. Добавлять новые стили, не ломая текущие.

- [ ] **Step 4: Добавить баннер в начале модалки при активной моно-блокировке**

В JSX в самом начале рендера (сразу после `<Modal.../>` открытия), до списка услуг:

```tsx
{!isChangeMode && occupiedCategories.size > 0 && [...occupiedCategories].some(isMonoApplicable) && (
  <Alert
    icon={<IconInfoCircle size={16} />}
    color="blue"
    variant="light"
    radius="md"
    mb="md"
  >
    {t('order.monoServiceBanner')}
  </Alert>
)}
```

Добавить к импортам из `@tabler/icons-react` `IconInfoCircle`.

- [ ] **Step 5: Verify (ручная проверка)**

```bash
npm run lint && npm run build && npm run dev
```

Сценарии:
- `MONO_SERVICE_ENABLE=false`: всё как раньше, ни блокировок, ни баннера.
- `MONO_SERVICE_ENABLE=true`, активна `vpn`, `MONO_SERVICE_CATEGORIES=vpn`: в каталоге (order-режим) VPN-услуги задизейблены с Tooltip, proxy/hosting доступны, сверху баннер.
- `MONO_SERVICE_ENABLE=true`, активна `vpn`, `MONO_SERVICE_CATEGORIES=''`: все категории задизейблены в order-режиме.
- Режим `change` (переход из ServiceDetail): фильтрации нет, всё кликабельно.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrderServiceModal.tsx src/pages/Services.tsx
git commit -m "feat(order): block incompatible services in catalog under mono-service mode"
```

---

### Task 5: i18n keys for mono-service

**Files:**
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Добавить ключи в `ru.json`**

В секцию `"services"` (около строки 170) добавить:

```json
"monoServiceNotice": "У вас уже есть активная подписка. Доступна смена тарифа, а не заказ дополнительных услуг.",
"changeService": "Сменить тариф",
```

В секцию `"order"` (около строки 267) добавить:

```json
"monoServiceBanner": "У вас уже есть активная подписка. Заказ дополнительных услуг в этой категории недоступен — используйте «Сменить тариф».",
"blockedByMono": "Недоступно при активной подписке"
```

- [ ] **Step 2: Добавить аналогичные ключи в `en.json`**

Найти соответствующие секции `services` и `order` и добавить:

```json
"monoServiceNotice": "You already have an active subscription. Only tariff change is available.",
"changeService": "Change tariff",
```

```json
"monoServiceBanner": "You already have an active subscription. Ordering additional services in this category is unavailable — use \"Change tariff\".",
"blockedByMono": "Unavailable while a subscription is active"
```

- [ ] **Step 3: Verify**

```bash
npm run build
```
В dev-режиме переключить язык на en/ru — убедиться, что оба ключа выводятся корректно, без fallback.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/ru.json src/i18n/locales/en.json
git commit -m "i18n: add translations for mono-service mode"
```

---

## Phase 2 — Quick actions on ServiceCard

Вынести ключевые действия подписки на саму карточку, чтобы пользователь видел их сразу.

### Task 6: Config flag for quick actions

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Добавить поле в `AppConfig`**

После ранее добавленных полей моно-режима:

```ts
  SHOW_CARD_QUICK_ACTIONS: string;
```

- [ ] **Step 2: Добавить значение по умолчанию в `getConfig()`**

```ts
    SHOW_CARD_QUICK_ACTIONS: runtimeConfig?.SHOW_CARD_QUICK_ACTIONS || import.meta.env.VITE_SHOW_CARD_QUICK_ACTIONS || 'true',
```

- [ ] **Step 3: Verify + Commit**

```bash
npm run lint && npm run build
git add src/config.ts
git commit -m "feat(config): add SHOW_CARD_QUICK_ACTIONS flag"
```

---

### Task 7: Surface subscription actions on ServiceCard

**Files:**
- Modify: `src/pages/Services.tsx` (компонент `ServiceCard`, строки 716–810)

- [ ] **Step 1: Расширить пропсы `ServiceCard`**

Заменить сигнатуру (строка 716):

```tsx
function ServiceCard({
  service,
  onClick,
  onQr,
  onChange,
  onStop,
  onDelete,
  isChild = false,
  isLastChild = false,
}: {
  service: UserService;
  onClick: () => void;
  onQr?: (service: UserService) => void;
  onChange?: (service: UserService) => void;
  onStop?: (service: UserService) => void;
  onDelete?: (service: UserService) => void;
  isChild?: boolean;
  isLastChild?: boolean;
}) {
```

- [ ] **Step 2: Вычислить доступные действия и отрисовать панель иконок**

Внутри `ServiceCard` после `const statusLabel = ...`:

```ts
  const showQuick = config.SHOW_CARD_QUICK_ACTIONS === 'true' && !isChild;
  const canQr = service.status === 'ACTIVE';
  const canChange = config.ALLOW_SERVICE_CHANGE === 'true' && ['ACTIVE', 'BLOCK'].includes(service.status);
  const canStop = config.ALLOW_SERVICE_BLOCKED === 'true' && service.status === 'ACTIVE';
  const canDelete = config.ALLOW_SERVICE_DELETE === 'true' && ['BLOCK', 'NOT PAID', 'ERROR'].includes(service.status);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
```

В основной ветке рендера (root-card, строки 782–809) внутри основного `<Group justify="space-between">` добавить новый блок иконок рядом со статусом:

```tsx
{showQuick && (
  <Group gap={4} onClick={stop} wrap="nowrap">
    {canQr && (
      <Tooltip label={t('services.showQr')} withArrow>
        <ActionIcon variant="subtle" color="blue" onClick={() => onQr?.(service)} aria-label="QR">
          <IconQrcode size={18} />
        </ActionIcon>
      </Tooltip>
    )}
    {canChange && (
      <Tooltip label={t('services.changeService')} withArrow>
        <ActionIcon variant="subtle" color="cyan" onClick={() => onChange?.(service)} aria-label="Change">
          <IconExchange size={18} />
        </ActionIcon>
      </Tooltip>
    )}
    {canStop && (
      <Tooltip label={t('services.stopService')} withArrow>
        <ActionIcon variant="subtle" color="orange" onClick={() => onStop?.(service)} aria-label="Stop">
          <IconPlayerStop size={18} />
        </ActionIcon>
      </Tooltip>
    )}
    {canDelete && (
      <Tooltip label={t('common.delete')} withArrow>
        <ActionIcon variant="subtle" color="red" onClick={() => onDelete?.(service)} aria-label="Delete">
          <IconTrash size={18} />
        </ActionIcon>
      </Tooltip>
    )}
  </Group>
)}
```

Импорты иконок `IconQrcode, IconExchange, IconPlayerStop, IconTrash` уже есть в файле (строка 4).

- [ ] **Step 3: Передать обработчики из родительского компонента**

В функции `Services()` (блок state, строка 813+) добавить:

```ts
  const [quickQrService, setQuickQrService] = useState<UserService | null>(null);
  const [stopTarget, setStopTarget] = useState<UserService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserService | null>(null);

  const handleQuickStop = async () => {
    if (!stopTarget) return;
    try {
      await api.post(`/user/service/stop`, { user_service_id: stopTarget.user_service_id });
      notifications.show({ title: t('common.success'), message: t('services.stopSuccess'), color: 'green' });
      setStopTarget(null);
      refreshAttemptsRef.current = 0;
      fetchServices();
    } catch {
      notifications.show({ title: t('common.error'), message: t('services.stopError'), color: 'red' });
    }
  };

  const handleQuickDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/user/service`, { data: { user_service_id: deleteTarget.user_service_id } });
      notifications.show({ title: t('common.success'), message: t('services.deleteSuccess'), color: 'green' });
      setDeleteTarget(null);
      refreshAttemptsRef.current = 0;
      fetchServices();
    } catch {
      notifications.show({ title: t('common.error'), message: t('services.deleteError'), color: 'red' });
    }
  };
```

> Точные URL-ы и payload должны совпадать с тем, что использует `ServiceDetail`. Сверься с [src/pages/Services.tsx](src/pages/Services.tsx) — функциями `handleDelete`/`handleStop` внутри `ServiceDetail` — и при необходимости скопируй вызовы один-в-один.

В рендере карточек (блок `.map((service) =>` около строки 1001) передать пропсы:

```tsx
<ServiceCard
  service={service}
  onClick={() => handleServiceClick(service)}
  onQr={(s) => setQuickQrService(s)}
  onChange={(s) => handleChangeTariff(s)}
  onStop={(s) => setStopTarget(s)}
  onDelete={(s) => setDeleteTarget(s)}
/>
```

(Обработчик `handleChangeTariff` уже существует на строке 928.)

- [ ] **Step 4: Подключить QrModal и ConfirmModal для быстрых действий**

В конце `Services()`, рядом с существующим `ConfirmModal` (строка ~1087), добавить:

```tsx
<QrModal
  opened={quickQrService !== null}
  onClose={() => setQuickQrService(null)}
  service={quickQrService}
/>

<ConfirmModal
  opened={stopTarget !== null}
  onClose={() => setStopTarget(null)}
  onConfirm={handleQuickStop}
  title={t('services.stopServiceTitle')}
  message={t('services.stopServiceMessage')}
  confirmLabel={t('services.stopService')}
  confirmColor="orange"
/>

<ConfirmModal
  opened={deleteTarget !== null}
  onClose={() => setDeleteTarget(null)}
  onConfirm={handleQuickDelete}
  title={t('services.deleteServiceTitle')}
  message={t('services.deleteServiceMessage')}
  confirmLabel={t('common.delete')}
  confirmColor="red"
/>
```

Импортировать `QrModal` в начале файла, если ещё не импортирован (он уже есть на строке 9).

> **Note:** `QrModal` может ожидать пропс с другим названием. Сверься с его актуальной сигнатурой в `src/components/QrModal.tsx` и передай ожидаемые поля (скорее всего `service` уже ок, но может называться `userService` или `opened/service` — адаптируй по факту).

- [ ] **Step 5: Verify (ручная проверка)**

```bash
npm run lint && npm run build && npm run dev
```

Сценарии:
- Активная услуга: на карточке видны иконки QR, Exchange, Stop (Delete — нет). Клик по иконке не открывает ServiceDetail (stopPropagation). Stop показывает confirm, после подтверждения — статус обновляется.
- BLOCK/NOT PAID/ERROR: видна иконка Delete, иконок QR и Stop нет.
- `SHOW_CARD_QUICK_ACTIONS=false`: иконки скрыты, старое поведение.
- Telegram WebApp: иконки отображаются читаемо (не ломают layout на узких экранах — Mantine `Group` без явного `wrap="nowrap"` в целевом блоке; можно добавить `wrap="nowrap"` если поджимается).
- Дочерние карточки (isChild): иконок нет (отключено через `showQuick`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Services.tsx
git commit -m "feat(services): surface QR/change/stop/delete actions on ServiceCard"
```

---

### Task 8: i18n keys for quick actions

**Files:**
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Убедиться, что присутствуют ключи**

В секции `services` обеих локалей должны быть (проверить, добавить отсутствующие):

```
services.showQr
services.stopService
services.stopServiceTitle
services.stopServiceMessage
services.stopSuccess
services.stopError
services.deleteServiceTitle
services.deleteServiceMessage
services.deleteSuccess
services.deleteError
```

Если часть уже есть (например, `deleteServiceTitle` используется ниже в файле — см. строку 1087 `Services.tsx`) — не дублируй. Добавь только отсутствующие с осмысленными русскими/английскими строками.

- [ ] **Step 2: Verify**

Запустить dev, последовательно нажать иконки на карточке — убедиться, что нет «ключей вместо перевода» (например, `services.showQr`).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/ru.json src/i18n/locales/en.json
git commit -m "i18n: add strings for ServiceCard quick actions"
```

---

## Phase 3 — Navigation simplification

Убрать «Платежи» и «Списания» из меню, превратив их в секции Профиля. Управляется флагом, чтобы можно было откатить.

### Task 9: Config flag for navigation layout

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Добавить поле**

В `AppConfig`:

```ts
  NAV_PAYMENTS_IN_PROFILE: string;
```

В `getConfig()`:

```ts
    NAV_PAYMENTS_IN_PROFILE: runtimeConfig?.NAV_PAYMENTS_IN_PROFILE || import.meta.env.VITE_NAV_PAYMENTS_IN_PROFILE || 'false',
```

- [ ] **Step 2: Verify + Commit**

```bash
npm run lint && npm run build
git add src/config.ts
git commit -m "feat(config): add NAV_PAYMENTS_IN_PROFILE flag"
```

---

### Task 10: Remove Payments/Withdrawals from header when flag is on

**Files:**
- Modify: `src/App.tsx` (вкладки навигации и BottomNavigation)
- Modify: `src/pages/Profile.tsx` (кнопки «История платежей/выводов»)

- [ ] **Step 1: Условно скрыть пункты из NAV_ITEMS в рендере**

В `src/App.tsx`, в блоке веб-хедера (строка 483, `NAV_ITEMS.map(...)`):

```tsx
{NAV_ITEMS
  .filter((item) =>
    config.NAV_PAYMENTS_IN_PROFILE === 'true'
      ? item.path !== '/payments' && item.path !== '/withdrawals'
      : true
  )
  .map((item) => {
    /* существующий код */
  })}
```

В `BottomNavigation` (мобильный / Telegram WebApp layout — читается на строке 433, сам компонент лежит отдельным файлом; найди его через Grep `BottomNavigation` или в `src/components/`) — применить ту же фильтрацию. Если BottomNavigation рендерит из `NAV_ITEMS` напрямую, просто прокинуть флаг или фильтровать там же, симметрично.

- [ ] **Step 2: Добавить кнопки в Profile**

Прочитать `src/pages/Profile.tsx`, найти блок с балансом / действиями профиля, и добавить секцию (только если `config.NAV_PAYMENTS_IN_PROFILE === 'true'`):

```tsx
{config.NAV_PAYMENTS_IN_PROFILE === 'true' && (
  <Group gap="sm">
    <Button
      leftSection={<IconCreditCard size={16} />}
      variant="light"
      onClick={() => setPayHistoryOpen(true)}
    >
      {t('nav.payments')}
    </Button>
    <Button
      leftSection={<IconReceipt size={16} />}
      variant="light"
      onClick={() => setWithdrawHistoryOpen(true)}
    >
      {t('nav.withdrawals')}
    </Button>
  </Group>
)}
```

В `Profile.tsx` импортировать `config`, иконки и локальный state/модалки `PayHistoryModal` и `WithdrawHistoryModal`. Если сейчас эти модалки рендерятся в `App.tsx` и управляются там, самый простой путь — **поднять события через store** (`useStore`) либо переместить сами модалки в `Profile.tsx`. Выбери вариант с меньшей диффузией: скорее всего добавить два поля в Zustand store (`payHistoryOpen`, `withdrawHistoryOpen`) и оставить рендер модалок в `App.tsx`, а кнопки в Profile просто меняют флаги в store.

Конкретно — в `src/store/useStore.ts` добавить:

```ts
  payHistoryOpen: boolean;
  setPayHistoryOpen: (v: boolean) => void;
  withdrawHistoryOpen: boolean;
  setWithdrawHistoryOpen: (v: boolean) => void;
```

с инициализацией `false` и соответствующими сеттерами. В `App.tsx` заменить локальный `useState` этих двух флагов на чтение из store; кнопки Profile пишут в тот же store.

- [ ] **Step 3: Verify (ручная проверка)**

```bash
npm run lint && npm run build && npm run dev
```

Сценарии:
- `NAV_PAYMENTS_IN_PROFILE=false` (по умолчанию): всё как раньше — «Платежи» и «Списания» в шапке и в bottom nav.
- `NAV_PAYMENTS_IN_PROFILE=true`, десктоп: в шапке остались только «Услуги» и «Профиль». В профиле — две кнопки, открывают соответствующие модалки.
- `NAV_PAYMENTS_IN_PROFILE=true`, Telegram WebApp / mobile: в нижней навигации только 2 иконки, модалки открываются из Profile.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/Profile.tsx src/store/useStore.ts
git commit -m "feat(nav): optionally move Payments/Withdrawals into Profile page"
```

---

## Финальная проверка

- [ ] **Step 1: Полная сборка и smoke-тест**

```bash
npm run lint
npm run build
npm run dev
```

Прогнать все три флага в двух положениях (all-off → поведение до плана, all-on → новое):

| Сценарий | Ожидание |
| --- | --- |
| Все флаги по умолчанию | Поведение как до PR, без регрессий |
| Только `MONO_SERVICE_ENABLE=true` | Кнопка «Заказать» → «Сменить», баннер, блокировки в каталоге |
| Только `SHOW_CARD_QUICK_ACTIONS=true` (уже true по умолчанию) | Иконки на карточках |
| Только `NAV_PAYMENTS_IN_PROFILE=true` | Платежи/списания в Профиле |
| Все флаги включены одновременно | Всё работает без конфликтов |

- [ ] **Step 2: Обновить документацию конфигурации (если есть)**

Проверить [README.md](README.md) и [docker-compose.yml](docker-compose.yml) — если там перечислены env-переменные, добавить:

- `MONO_SERVICE_ENABLE` / `VITE_MONO_SERVICE_ENABLE` (default `false`)
- `MONO_SERVICE_CATEGORIES` (CSV, default `''`)
- `MONO_SERVICE_STATUSES` (CSV, default `ACTIVE,NOT PAID,PROGRESS`)
- `SHOW_CARD_QUICK_ACTIONS` (default `true`)
- `NAV_PAYMENTS_IN_PROFILE` (default `false`)

- [ ] **Step 3: Bump version**

В `package.json` поднять patch-версию (текущая `2.5.3` → `2.6.0` — т.к. новая опциональная фича). Использовать существующий скрипт [release.sh](release.sh), если так принято в проекте.

- [ ] **Step 4: Final commit**

```bash
git add README.md package.json
git commit -m "docs: document new UX feature flags; bump to 2.6.0"
```

---

## Phase 4 — Portable CI: build into GHCR of the current repo/owner

**Контекст:** сейчас [.github/workflows/release.yml](.github/workflows/release.yml) и [.github/workflows/docker-push.yml](.github/workflows/docker-push.yml) публикуют в Docker Hub по зашитому имени `danuk/shm` и требуют секреты `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`. Это ломает форки: чтобы собрать контейнер под своим аккаунтом, нужно править YAML.

**Цель:** при форке/переносе репозитория workflow должен «из коробки» собирать и пушить образ в **GitHub Container Registry** (`ghcr.io`) под текущего владельца (`github.repository_owner`) и с именем образа, производным от `github.repository`. Никаких ручных секретов.

### Task 11: Release workflow → GHCR, owner/repo-derived name

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Заменить `env` блок**

Строки 8-10 (`env: REGISTRY / IMAGE_NAME`) заменить на:

```yaml
env:
  REGISTRY: ghcr.io
  # Имя образа = owner/repo в нижнем регистре (GHCR требует lowercase).
  # Вычисляется на лету в шаге "Compute image name".
```

- [ ] **Step 2: Заменить шаг логина в Docker Hub на GHCR**

Строки 31-35 (`Log in to Docker Hub`) заменить на:

```yaml
    - name: Log in to GHCR
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
```

Секреты `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` больше не нужны — `GITHUB_TOKEN` выдаётся автоматически каждому запуску. Напомни пользователю: в настройках репо должен быть разрешён `Settings → Actions → General → Workflow permissions → Read and write`.

- [ ] **Step 3: Вычислять имя образа из `github.repository`**

Перед шагом `Extract version info` (строка 37) добавить новый шаг:

```yaml
    - name: Compute image name
      id: image
      run: |
        # GHCR требует lowercase
        REPO_LC=$(echo "${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
        echo "name=${{ env.REGISTRY }}/${REPO_LC}" >> $GITHUB_OUTPUT
        echo "Image base: ${{ env.REGISTRY }}/${REPO_LC}"
```

Тогда для `owner/shm-client-4` получится `ghcr.io/owner/shm-client-4`.

- [ ] **Step 4: Заменить использование `env.IMAGE_NAME` в блоке `Build and push client-2 image`**

В шаге `Build and push client-2 image` (строки 84-96) заменить все вхождения `${{ env.IMAGE_NAME }}` на `${{ steps.image.outputs.name }}`. Результирующий блок:

```yaml
    - name: Build and push client-2 image
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        target: client
        tags: |
          ${{ steps.image.outputs.name }}-client-2:${{ steps.version.outputs.tag }}
          ${{ steps.version.outputs.push_latest == 'true' && format('{0}-client-2:{1}', steps.image.outputs.name, steps.version.outputs.minor) || format('{0}-client-2:skip-minor-{1}', steps.image.outputs.name, steps.version.outputs.rev) }}
          ${{ steps.version.outputs.push_latest == 'true' && format('{0}-client-2:latest', steps.image.outputs.name) || format('{0}-client-2:skip-latest-{1}', steps.image.outputs.name, steps.version.outputs.rev) }}
        cache-from: type=gha,scope=client-2
        cache-to: type=gha,mode=max,scope=client-2
```

- [ ] **Step 5: Обновить описание GitHub Release**

В блоке `Create GitHub Release` в `body:` (строки 104-116) заменить `${{ env.IMAGE_NAME }}` на `${{ steps.image.outputs.name }}` во всех трёх местах.

- [ ] **Step 6: Verify**

```bash
# Проверить YAML-синтаксис
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```
Если `yamllint` установлен, прогнать и его. Ошибок быть не должно.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): publish to GHCR under current repository owner"
```

---

### Task 12: Manual docker-push workflow → GHCR

**Files:**
- Modify: `.github/workflows/docker-push.yml`

- [ ] **Step 1: Заменить шаг логина**

Строки 27-31 (`Login to Docker Hub`) заменить на:

```yaml
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Добавить шаг вычисления имени образа**

Перед `Get version info` (строка 33) добавить:

```yaml
      - name: Compute image name
        id: image
        run: |
          REPO_LC=$(echo "${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          echo "name=ghcr.io/${REPO_LC}" >> $GITHUB_OUTPUT
```

- [ ] **Step 3: Заменить теги в `Build and push`**

В шаге `Build and push Clernt` (строки 75-86) заменить секцию `tags:`:

```yaml
          tags: |
            ${{ steps.image.outputs.name }}-client-2:${{ steps.version.outputs.minor }}
            ${{ steps.version.outputs.push_latest == 'true' && format('{0}-client-2:latest', steps.image.outputs.name) || format('{0}-client-2:skip-latest-{1}', steps.image.outputs.name, steps.version.outputs.rev) }}
```

- [ ] **Step 4: Убедиться, что у job есть права `packages: write`**

В начале `jobs.build-and-push` (после `runs-on: ubuntu-latest` на строке 14) добавить:

```yaml
    permissions:
      contents: read
      packages: write
```

- [ ] **Step 5: Verify**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/docker-push.yml'))"
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/docker-push.yml
git commit -m "ci(docker-push): publish to GHCR under current repository owner"
```

---

### Task 13: Document GHCR migration

**Files:**
- Modify: `README.md` (если описывает сборку/публикацию)
- Modify: `docker-compose.yml` (если содержит прежний `image: danuk/shm-...`)

- [ ] **Step 1: Проверить README и docker-compose**

Открыть оба файла и найти упоминания `danuk/shm` или `docker.io`. Заменить на инструкцию:

> Образы публикуются в GHCR текущего репозитория: `ghcr.io/<owner>/<repo>-client-2:<tag>`.
> Для форка никаких дополнительных секретов не требуется — workflow использует `GITHUB_TOKEN` автоматически. Убедись, что в `Settings → Actions → General` выбрано «Read and write permissions».

В `docker-compose.yml`, если есть захардкоженный образ `danuk/shm-client-2:...`, заменить его на переменную:

```yaml
image: ${IMAGE:-ghcr.io/your-owner/your-repo-client-2:latest}
```

- [ ] **Step 2: Verify**

Собрать репо локально (`docker compose config` — проверит подстановку), убедиться, что parser не ругается.

- [ ] **Step 3: Commit**

```bash
git add README.md docker-compose.yml
git commit -m "docs: document GHCR-based image publishing"
```

---

### Post-migration manual step (для оператора, не для агента)

- [ ] В репозитории на GitHub: **Settings → Actions → General → Workflow permissions** → выбрать **Read and write permissions**
- [ ] После первого успешного пуша: в **Packages** проверить, что пакет появился; при необходимости поменять видимость (Public/Private) в настройках пакета
- [ ] Старые Docker Hub секреты (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`) можно удалить из Settings → Secrets
