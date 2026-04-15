# Visual Redesign Proposal

**Date:** 2026-04-15
**Scope:** SHM Client 4 subscription dashboard — dark glassmorphism skin layered on top of existing Mantine 8 theme.
**Non-goals:** refactoring business logic, rewriting pages from scratch, altering API contracts.

---

## 1. Design tokens

### Color palette (dark-first)

| Token | Value | Usage |
|---|---|---|
| `--shm-bg-base`        | `#0B0B14` | body background |
| `--shm-bg-surface`     | `rgba(255,255,255,0.04)` | glass cards |
| `--shm-bg-raised`      | `rgba(255,255,255,0.07)` | hovered / modal content |
| `--shm-border-glass`   | `rgba(255,255,255,0.06)` | 1px hairline on glass |
| `--shm-border-strong`  | `rgba(255,255,255,0.12)` | focused / active borders |
| `--shm-accent-300`     | `#B9A3FF` | hover, icon tints |
| `--shm-accent-400`     | `#8A6BFF` | primary accent |
| `--shm-accent-500`     | `#6A4BFF` | base brand |
| `--shm-accent-600`     | `#4F35D6` | pressed state |
| `--shm-success`        | `#2ED687` (pill bg `rgba(46,214,135,0.15)`) |
| `--shm-warning`        | `#FFB547` |
| `--shm-danger`         | `#FF5A6B` |
| `--shm-text-primary`   | `#FFFFFF` |
| `--shm-text-secondary` | `rgba(255,255,255,0.72)` |
| `--shm-text-muted`     | `rgba(255,255,255,0.48)` |

Light-mode counterparts should be derived by swapping base (`#F6F6FB`), keeping accent hues, and using `rgba(10,10,20,0.04)` glass surfaces — but per the reference, dark is the primary target.

### Gradients & glows

- **Balance gradient** (balance card bg): `linear-gradient(135deg, #5B3DF5 0%, #8A6BFF 55%, #B9A3FF 100%)`, with a low-opacity radial highlight `radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.22), transparent 60%)` composited on top.
- **Primary CTA gradient** (main action button, e.g. "Подключение"): `linear-gradient(90deg, #6A4BFF 0%, #3E8BFF 100%)`.
- **Ambient page glow**: fixed behind content, `radial-gradient(60% 40% at 20% 10%, rgba(106,75,255,0.35), transparent 70%)` plus a cooler one bottom-right `rgba(62,139,255,0.20)`.

### Glass surface spec

```
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.06);
backdrop-filter: blur(20px) saturate(140%);
-webkit-backdrop-filter: blur(20px) saturate(140%);
box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
```

### Radii

| Token | Mantine map | Value |
|---|---|---|
| `pill`      | `xl` override | 999px |
| `card`      | `lg`          | 20px |
| `button`    | `md`          | 14px |
| `icon-tile` | `sm`          | 12px |

### Spacing & typography

Reuse Mantine `xs/sm/md/lg/xl` scale (`8/12/16/20/24`). Add `--shm-space-2xl: 32px` for card gutters on mobile. Typography: stay on Inter; headings `fw=700`, body `fw=500`, captions `fw=500 c=dimmed`. Balance number uses `fz=34 fw=700 lh=1.1`.

---

## 2. Mantine theme wiring

Extract theme into a new file **[src/theme.ts](src/theme.ts)** (currently inlined at [src/App.tsx:29-54](src/App.tsx)). Sketch:

```ts
// src/theme.ts
import { createTheme, rem } from '@mantine/core';

export const shmTheme = createTheme({
  primaryColor: 'violet',
  primaryShade: { light: 6, dark: 5 },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'lg',
  radius: { xs: rem(8), sm: rem(12), md: rem(14), lg: rem(20), xl: rem(999) },
  colors: {
    violet: ['#F1ECFF','#D9CBFF','#B9A3FF','#9E82FF','#8A6BFF','#6A4BFF','#5B3DF5','#4F35D6','#3E27B0','#2D1C85'],
    // override dark scale so Mantine surfaces read as near-black
    dark:   ['#E6E6EE','#C9C9D4','#9A9AA8','#70707F','#4B4B56','#2E2E38','#1A1A24','#111119','#0B0B14','#07070D'],
  },
  other: {
    glass:      'rgba(255,255,255,0.04)',
    glassBorder:'rgba(255,255,255,0.06)',
    blurBg:     'blur(20px) saturate(140%)',
    gradBalance:'linear-gradient(135deg,#5B3DF5 0%,#8A6BFF 55%,#B9A3FF 100%)',
    gradCTA:    'linear-gradient(90deg,#6A4BFF 0%,#3E8BFF 100%)',
  },
  components: {
    Modal: { defaultProps: { lockScroll: false, radius: 'lg' } },
    Card:  { defaultProps: { radius: 'lg', withBorder: false } },
    Button:{ defaultProps: { radius: 'md' } },
    Paper: { defaultProps: { radius: 'lg' } },
  },
});
```

In [src/App.tsx:574](src/App.tsx), change `<MantineProvider theme={theme} defaultColorScheme="auto">` to `defaultColorScheme="dark"`. Keep the toggle for Phase 1 (behind a flag — see §5). If/when we commit fully to dark-only, swap to `forceColorScheme="dark"` and hide `ThemeToggle`. Mantine's `MantineProvider` honors both props; `forceColorScheme` wins over user prefs and removes the toggle's effect.

Global CSS vars (§1) go in [src/index.css](src/index.css) inside `:root[data-mantine-color-scheme="dark"]`, and the ambient glow is a fixed `::before` on `body`.

---

## 3. Component redesign sketches

- **AppShell.Header** — sticky, `background: rgba(11,11,20,0.6)`, `backdrop-filter: blur(16px)`, hairline bottom border `var(--shm-border-glass)`. Tabs become pill-shaped segmented control (`variant="subtle"`, active tab uses `--shm-accent-500` with 18% alpha fill + white text). Remove the solid divider currently visible.

- **ServiceCard (active subscription)** — glass panel (§1 spec). Title row: service name `fw=700`, right-aligned `Online/Offline` **pill** (`bg rgba(46,214,135,0.15) c=#2ED687 fw=600` small). Second row: clock icon + "7 дн. осталось • 23.04" in secondary text. Primary CTA row: full-width gradient `Button` ("Подключение / Получить ключ") using `gradCTA`, `h=52`, `radius=md`. Below it a secondary action row: outlined glass `Button` "Изменить тариф" + square `ActionIcon` glass "Поделиться". This wires naturally into the Task 7 quick-actions plan (actions move out of the hidden modal into the card itself).

- **Balance card** (new section, top of Dashboard or Profile) — full-width glass card, but background is `gradBalance`. Left: 48×48 rounded-square icon tile (`bg rgba(255,255,255,0.16)`, white wallet icon). Center: caption "Баланс" `c=rgba(255,255,255,0.72)`, balance amount `fz=34 fw=700 c=white`. Right: outlined glass button "Пополнить" (`variant=default`, `bg rgba(255,255,255,0.14)`, white text, no border). Opens the existing PayModal.

- **Promo code card / Referral card** — glass `Paper`, left-aligned 40×40 icon tile: purple (`rgba(106,75,255,0.18)` bg, `#B9A3FF` ticket icon) for promo, orange (`rgba(255,181,71,0.18)` + `#FFB547` link icon) for referral. Title `fw=600` + one-line muted descriptor. Whole card is clickable, no explicit button — chevron on the right. Promo opens the current [PromoModal](src/components/PromoModal.tsx); referral expands to stats.

- **Referral stats inline** — two equal glass mini-cards in a `SimpleGrid cols={2} spacing="sm"`. Each: big number `fw=700 fz=22`, small muted caption below ("приглашено" / "заработано ₽").

- **Empty state** (no services) — centered glass card, 96×96 circular tinted icon (wallet-plus), headline "Подключите первый тариф", muted body, primary gradient CTA "Выбрать тариф" that opens the order catalog.

- **Order catalog modal** — keep [OrderServiceModal](src/components/OrderServiceModal.tsx) but restyle: `radius=lg`, `overlay` = `rgba(7,7,13,0.72)` + `blur=4`; body is glass surface. Service rows become stackable glass cards, selected state shown with a 1px `--shm-accent-500` border + subtle inner glow (`inset 0 0 0 1px rgba(138,107,255,0.6), 0 0 24px rgba(138,107,255,0.25)`).

- **Footer** — text-only, `fz=12 c=muted`, icons `size=12`, horizontal center; links to admin / full version.

---

## 4. Dedicated Dashboard screen

**Recommendation: YES — add `/dashboard` and make it the landing route (`/`), demote the current Services list to `/services`.**

Reasoning:

- The reference screenshot is a *dashboard*, not a list. Balance, active subscription summary, promo and referral are distinct concerns that currently compete for attention inside [Services.tsx](src/pages/Services.tsx) (1100 lines) and [Profile.tsx](src/pages/Profile.tsx) (808 lines).
- Users' first question on open is "how much time / money do I have left" — a dashboard answers that in one glance; a scrollable services list does not.
- Telegram WebApp sessions are short and mobile — a one-screen summary with deep-links fits that pattern better than tabbed browsing.
- Keeping Services as its own screen preserves power-user flows (multiple services, stop/change) without overloading the landing.
- Risk of duplication is low because the Dashboard *summarizes*, never reimplements — it links into existing pages and modals.

**Content split**

| Dashboard `/` | Services `/services` | Profile `/profile` |
|---|---|---|
| Balance card (+ "Пополнить") | Full list of user services with filters | Account identity, email, passkeys, OTP |
| Active subscription summary (1 card, the nearest-expiry service) | Order catalog entry-point | Language, theme, logout |
| Promo code tile | Stop / Change tariff flows | Partner link block (moved to Referral card on dashboard if preferred) |
| Referral tile + 2 mini-stats | | Forecast (keep here, detailed) |
| Footer links (admin / full) | | |

**Navigation** — header tabs become: **Главная / Услуги / Профиль**. Payments and Withdrawals stay as modals, now reachable from Profile *and* from a "History" action on the balance card.

**Layout**

- Mobile (<640px): single column stack in the order listed above, 16px gutter, 24px between sections.
- Tablet (640–1024): 2-column grid; balance spans both columns; subscription + promo on row 2; referral spans both columns.
- Desktop (>1024): 3-column grid, balance spans all three at top; subscription card (col 1–2), promo (col 3); referral (all three) with inline stats right-aligned.

**API sources** (verified in [src/api/client.ts](src/api/client.ts)):

- Balance + user meta: `userApi.getProfile()` → `/user` (returns `balance`, `partner_id`, etc.) — [client.ts:129](src/api/client.ts).
- Forecast "to pay" amount: `userApi.getForecast()` — [client.ts:148](src/api/client.ts).
- Active service(s): `userApi.getServices()` → `/user/service?limit=1000` — [client.ts:135](src/api/client.ts). Dashboard picks the one with nearest `expire`.
- Pay systems for "Пополнить" button: `userApi.getPaySystems()` — [client.ts:147](src/api/client.ts).
- Promo: `promoApi.apply()` — [client.ts:184](src/api/client.ts).
- **Referral: no dedicated endpoint exists today.** The current Profile builds a partner link client-side from `profile.user_id` ([Profile.tsx:103](src/pages/Profile.tsx)); `userApi.getWithdrawals()` gives earned totals. Dashboard referral stats should aggregate from `getWithdrawals()` + `getProfile()` until a `/user/partner` summary endpoint is added (flag as backend follow-up).

---

## 5. Rollout plan

**Phase 1 — Token foundation (behind `THEME_GLASSMORPHISM_ENABLE`).** Extract theme into `src/theme.ts`, add CSS variables to `index.css`, wire `defaultColorScheme="dark"` only when flag on. No visual changes to individual components yet; verify Mantine surfaces still render and light mode is untouched. Ships immediately after `feat/ux-improvements` merges.

**Phase 2 — Glass chrome.** AppShell header, Card/Paper/Modal defaults pick up the glass spec via Mantine component defaults + a small `classNames` layer. ServiceCard gets the gradient CTA and inline quick actions (coordinated with Task 7). Still flag-gated; operators can A/B by flipping `THEME_GLASSMORPHISM_ENABLE` in `config.ts`.

**Phase 3 — Balance / promo / referral cards.** Introduce `BalanceCard`, `PromoCard`, `ReferralCard` components used inside the existing Profile page first (lowest-risk surface). Keeps page URLs unchanged. Validates the visual system on real data before route changes.

**Phase 4 — Dashboard route (behind `DASHBOARD_PAGE_ENABLE`).** Add `/dashboard` as a new route that composes the Phase-3 components + a subscription summary. When flag off, landing stays at Services. When on, `/` redirects to `/dashboard` and Services moves to `/services`. Nav tabs updated. Two flags compose: an operator can enable glass without dashboard, or vice-versa.

**Phase 5 — Cleanup & default-on.** After a stability window, flip both flags default-true, remove legacy styles and the light/dark toggle if product agrees. Delete the dead Services-as-landing code paths.

---

## 6. Risks / open questions

- **`backdrop-filter` support.** iOS Safari and Chromium are fine. Firefox ESR and some embedded Android webviews (older Telegram WebApp on Android < 12) render blur as a flat translucent fill — acceptable fallback, but test. Provide a `@supports not (backdrop-filter: blur(1px))` fallback that bumps glass bg opacity to `0.10` so text contrast stays legible.
- **Telegram WebApp theme.** Telegram injects `themeParams` and `colorScheme` via `window.Telegram.WebApp`. If we use `forceColorScheme="dark"` we deliberately ignore that, which is fine for brand consistency but means users on Telegram light theme will see a mismatch at the edges (root html background flash). Mitigation: set `document.documentElement.style.background = '#0B0B14'` early in [main.tsx](src/main.tsx) before React mounts, and call `tgWebApp.setHeaderColor('#0B0B14')` / `setBackgroundColor` on init.
- **Accessibility / contrast.** Translucent white text on a busy blurred background can drop below WCAG AA. Mitigation: keep primary text at full white on surfaces with at least `0.04` glass tint over `#0B0B14` (measured ~13:1), but avoid placing body text directly over the purple balance gradient without a darkening overlay — use `rgba(0,0,0,0.15)` mask under text blocks on the balance card.
- **Performance of blur on low-end devices.** 4+ simultaneous `backdrop-filter: blur(20px)` layers visibly drop FPS on Android Go / older iPhones. Mitigation: limit blur to the header + modal overlay; cards use `background-color` only with a fake-glass `linear-gradient` — cheaper and visually close. Consider a `prefers-reduced-transparency` media-query opt-out.
- **Mantine v8 + CSS vars.** `createTheme.other` values aren't automatically exposed as CSS vars; we either read via `useMantineTheme().other` or declare them manually in `index.css`. Manual declaration keeps non-React surfaces (email templates, static error pages) themeable — preferred.
- **Open question — referral endpoint.** No `/user/partner` summary API exists. Do we build the dashboard referral tile from existing withdrawals + client-computed link, or block the tile until backend adds a proper summary endpoint?
- **Open question — light mode.** Do we keep it as a supported theme (invest in mirrored tokens) or deprecate it? The reference design is strictly dark; keeping light doubles the QA surface.
