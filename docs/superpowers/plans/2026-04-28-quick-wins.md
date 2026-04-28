# Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-load bundle size, restore working `npm run lint`, fix a Telegram OIDC popup-poll resource leak, and bring `de/es/fr/uz/ar` locales up to parity with `en.json`.

**Architecture:** Six independent micro-changes on a single feature branch `chore/quick-wins`, one commit per task. No new dependencies (all required libs are already in `package.json`). No new tests — repo has no test framework yet, verification is via `tsc -b`, `npm run lint`, and `npm run build` chunk inspection.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Mantine 8, react-router-dom 7, i18next 25, eslint 9 (flat config), typescript-eslint 8, Node ≥20.

---

## File Structure

| File | Op | Responsibility |
|------|----|----------------|
| `eslint.config.js` | create | Flat-config eslint setup for ts/tsx |
| `src/App.tsx` | modify | Lazy-load page components + Suspense fallback |
| `src/pages/Profile.tsx` | modify | Fix OIDC popup poll-timer leak (cleanup on unmount) + lazy import of payment modals |
| `src/pages/Services.tsx` | modify | Lazy import of OrderServiceModal, QrModal |
| `src/components/OrderServiceModal.tsx` | modify | Lazy import of PayModal (used in non-change CTA flow) |
| `vite.config.ts` | modify | Add `build.rollupOptions.output.manualChunks` for vendor splitting |
| `scripts/sync-i18n.mjs` | create | One-shot Node script that copies missing keys from `en.json` into the 5 new locales (deep merge, preserves existing translations) |
| `src/i18n/locales/{de,es,fr,uz,ar}.json` | modify | Output of the sync script — 34 added keys per file |
| `package.json` | modify | Bump version to 2.8.1 |

---

## Task 1: Add `eslint.config.js` (flat config)

**Why:** `npm run lint` currently crashes (`ESLint couldn't find an eslint.config.(js|mjs|cjs) file`). The plugins are already in `package.json`; we just need a config.

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public/config.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

- [ ] **Step 2: Verify lint runs (warnings allowed, no crash)**

Run: `npm run lint`
Expected: exits with non-zero possible (existing warnings), but no `ESLint couldn't find` crash. Save the warning count to compare later.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): add eslint flat config so npm run lint works again

Picks up the existing react-hooks, react-refresh and typescript-eslint
deps that were already in package.json but never wired up after the
ESLint v9 flat-config migration."
```

---

## Task 2: Fix OIDC popup poll-timer leak in Profile

**Why:** [`Profile.tsx:handleTelegramOidcBind`](src/pages/Profile.tsx) sets a `window.setInterval(700ms)` that polls `popup.closed` for up to 180 s. The timer is only cleared inside its own callback. If the user navigates away from Profile (or closes the tab) while the popup is still open, the timer keeps firing and holding a reference to the closed-component state setters, which logs warnings in dev and is a real (small) memory leak.

**Files:**
- Modify: `src/pages/Profile.tsx`

- [ ] **Step 1: Replace local `pollTimer` with a ref + cleanup effect**

In `Profile.tsx`, locate `handleTelegramOidcBind`. Find the existing block:

```tsx
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
```

Refactor to use a ref so cleanup can be done on unmount.

Near the other `useState` declarations at the top of the component, add:

```tsx
  const oidcPollTimerRef = useRef<number | null>(null);
```

Add `useRef` to the imports at the top of the file:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
```

Replace the block above with:

```tsx
      const startedAt = Date.now();
      oidcPollTimerRef.current = window.setInterval(async () => {
        if (!popup.closed) {
          if (Date.now() - startedAt < 180000) {
            return;
          }
          if (oidcPollTimerRef.current !== null) {
            window.clearInterval(oidcPollTimerRef.current);
            oidcPollTimerRef.current = null;
          }
          setTelegramWaitingOpen(false);
          return;
        }

        if (oidcPollTimerRef.current !== null) {
          window.clearInterval(oidcPollTimerRef.current);
          oidcPollTimerRef.current = null;
        }
        setTelegramWaitingOpen(false);
        await loadTelegramSettings();
      }, 700);
```

Right after the existing `useEffect` blocks (the one that handles `?tg_status`), add the unmount cleanup effect:

```tsx
  useEffect(() => {
    return () => {
      if (oidcPollTimerRef.current !== null) {
        window.clearInterval(oidcPollTimerRef.current);
        oidcPollTimerRef.current = null;
      }
    };
  }, []);
```

- [ ] **Step 2: Verify type-check**

Run: `./node_modules/.bin/tsc -b --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Verify lint stays green-ish**

Run: `npm run lint -- src/pages/Profile.tsx`
Expected: same warning baseline as Task 1; **no** new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "fix(profile): clear OIDC popup-poll timer on unmount

The 700ms popup-poll setInterval used to live in a closure and was
only cleared from inside its own callback. If the user navigated
away from Profile while the Telegram OIDC popup was still open, the
timer kept running for up to 180s, holding refs to setters of an
unmounted component. Move the handle into a ref and clear it from
an unmount effect."
```

---

## Task 3: Lazy-load page components

**Why:** Production bundle is currently a single 950 KB JS chunk (290 KB gzip). The 5 routed pages can be code-split — first paint on `/login` no longer needs `Services`/`Profile`/`Dashboard` code.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Convert page imports to `lazy()`**

In `src/App.tsx`, the top of the file currently has:

```tsx
import { useEffect, useState } from 'react';
...
import Services from './pages/Services';
import Profile from './pages/Profile';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
```

Change `useState` import to also include `Suspense` and `lazy` from React:

```tsx
import { useEffect, useState, Suspense, lazy } from 'react';
```

Replace the five page imports with:

```tsx
const Services = lazy(() => import('./pages/Services'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

- [ ] **Step 2: Add `<Suspense>` around `<Routes>` and around the standalone `<Login />` render**

There are three render sites in `AppContent`:

1. The `if (!isAuthenticated) return <Login />;` early return.
2. The Telegram-WebApp branch with its `<Routes>...</Routes>`.
3. The desktop `<AppShell.Main><Routes>...</Routes></AppShell.Main>` branch.

For (1), replace:

```tsx
  if (!isAuthenticated) {
    return <Login />;
  }
```

with:

```tsx
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<Center mih="100vh"><Loader /></Center>}>
        <Login />
      </Suspense>
    );
  }
```

For (2) and (3), wrap the existing `<Routes>` JSX:

```tsx
            <Suspense fallback={<Center mih="50vh"><Loader /></Center>}>
              <Routes>
                {/* existing routes */}
              </Routes>
            </Suspense>
```

Apply this in both render sites (Telegram WebApp branch and desktop AppShell branch).

- [ ] **Step 3: Verify type-check + build produces extra chunks**

Run: `./node_modules/.bin/tsc -b --noEmit && ./node_modules/.bin/vite build`
Expected: build succeeds; `dist/assets/` now contains multiple JS files (one large `index-*.js` plus per-page chunks named e.g. `Services-*.js`, `Profile-*.js`). Note total size and main-chunk size for the next task's comparison.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "perf(routes): lazy-load page components

Splits Services / Profile / Login / Dashboard / NotFound into
separate chunks. Wraps the three render sites with React.Suspense
fallbacks so the loading state is consistent across mobile (Telegram
WebApp) and desktop (AppShell) branches."
```

---

## Task 4: Lazy-load heavy modals

**Why:** Modals are mounted permanently in the tree (rendered by their parent components even when `opened={false}`). They pull in form/QR/large data tables that aren't needed before first interaction.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Services.tsx`

- [ ] **Step 1: Lazy-load `PayHistoryModal` and `WithdrawHistoryModal` in App**

In `src/App.tsx`, change:

```tsx
import PayHistoryModal from './components/PayHistoryModal';
import WithdrawHistoryModal from './components/WithdrawHistoryModal';
```

to:

```tsx
const PayHistoryModal = lazy(() => import('./components/PayHistoryModal'));
const WithdrawHistoryModal = lazy(() => import('./components/WithdrawHistoryModal'));
```

These are already rendered inside the same `<Suspense>`-friendly tree. Mantine `<Modal>` doesn't render children when `opened={false}`, so a `lazy()`-wrapped component inside it will only fetch its chunk on first open. Wrap each modal site with its own minimal Suspense to keep the rest of the page from blocking:

Find both render sites (one in the Telegram WebApp branch, one at the bottom of desktop branch):

```tsx
        <PayHistoryModal opened={payHistoryOpen} onClose={() => setPayHistoryOpen(false)} />
        <WithdrawHistoryModal opened={withdrawHistoryOpen} onClose={() => setWithdrawHistoryOpen(false)} />
```

Wrap each pair in its own Suspense:

```tsx
        <Suspense fallback={null}>
          <PayHistoryModal opened={payHistoryOpen} onClose={() => setPayHistoryOpen(false)} />
          <WithdrawHistoryModal opened={withdrawHistoryOpen} onClose={() => setWithdrawHistoryOpen(false)} />
        </Suspense>
```

- [ ] **Step 2: Lazy-load `OrderServiceModal` and `QrModal` in Services**

In `src/pages/Services.tsx`, locate the imports:

```tsx
import OrderServiceModal from '../components/OrderServiceModal';
import QrModal from '../components/QrModal';
```

(If exact import lines differ, find the matching ones.) Replace with:

```tsx
import { lazy, Suspense } from 'react';
// ...keep other react imports unchanged...
const OrderServiceModal = lazy(() => import('../components/OrderServiceModal'));
const QrModal = lazy(() => import('../components/QrModal'));
```

If `lazy`/`Suspense` are already imported from React (e.g. via `import { useState, useEffect } from 'react'`), add them to that existing import line instead of a duplicate `import` to satisfy lint.

Wrap the modal render sites with `<Suspense fallback={null}>`. There are two `<OrderServiceModal>` instances near the bottom of the file (one for `mode="order"`, one for `mode="change"`) and one `<QrModal>`:

```tsx
      <Suspense fallback={null}>
        <OrderServiceModal
          /* ...existing props... */
        />
        <OrderServiceModal
          /* ...existing change-mode props... */
        />
      </Suspense>
      {quickQrService && quickQrData && (
        <Suspense fallback={null}>
          <QrModal
            opened
            onClose={() => { setQuickQrService(null); setQuickQrData(null); }}
            data={quickQrData}
            title={t('services.qrCode')}
          />
        </Suspense>
      )}
```

- [ ] **Step 3: Verify type-check + build**

Run: `./node_modules/.bin/tsc -b --noEmit && ./node_modules/.bin/vite build`
Expected: build succeeds; `dist/assets/` shows additional `OrderServiceModal-*.js`, `QrModal-*.js`, `PayHistoryModal-*.js`, `WithdrawHistoryModal-*.js` chunks; main `index-*.js` is smaller than after Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/Services.tsx
git commit -m "perf(modals): lazy-load PayHistory/WithdrawHistory/OrderService/Qr modals

These modals are rendered with opened={false} on every page load
but pulled their full code (form, table, QR libs) into the main
chunk. Wrap each render site in <Suspense fallback={null}> so the
chunk only loads on first open."
```

---

## Task 5: Vite vendor `manualChunks`

**Why:** A `vendor.js` chunk for `@mantine/*`, `@tabler/icons-react`, `axios`, `react`/`react-dom` is cacheable across deploys and stops being re-fetched on every JS-only fix release.

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add `build.rollupOptions.output.manualChunks`**

Replace the entire content of `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mantine': [
            '@mantine/core',
            '@mantine/dates',
            '@mantine/form',
            '@mantine/hooks',
            '@mantine/modals',
            '@mantine/notifications',
          ],
          'vendor-icons': ['@tabler/icons-react'],
          'vendor-i18n': ['i18next', 'i18next-browser-languagedetector', 'react-i18next'],
          'vendor-misc': ['axios', 'qrcode.react', 'zustand'],
        },
      },
    },
  },
})
```

- [ ] **Step 2: Verify build produces vendor chunks**

Run: `./node_modules/.bin/vite build`
Expected: `dist/assets/` contains files matching `vendor-react-*.js`, `vendor-mantine-*.js`, `vendor-icons-*.js`, `vendor-i18n-*.js`, `vendor-misc-*.js`. The main `index-*.js` should now be well under 500 KB and Vite's chunk-size warning should be gone.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "perf(build): split vendor bundles into long-cacheable chunks

Mantine, @tabler/icons-react, react+router, i18next stack and a
miscellaneous (axios/qrcode/zustand) bundle are split out into
separate vendor-* chunks. Combined with route/modal lazy loading
this brings the main entry chunk under Vite's 500KB warning and
makes vendor caches survive most JS-only releases."
```

---

## Task 6: Sync missing keys from `en.json` into 5 new locales

**Why:** `de/es/fr/uz/ar` each miss 34 keys that exist in `en.json` (fork-specific keys: `dashboard.*`, mono-service strings, OIDC merge/unbind, login-already-in-use hint, etc.). Currently i18next falls back to `DEFAULT_LANGUAGE=ru`, which is a poor experience for a German user. English is a better fallback than Russian for non-RU users.

**Files:**
- Create: `scripts/sync-i18n.mjs`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/uz.json`
- Modify: `src/i18n/locales/ar.json`

- [ ] **Step 1: Create the sync script**

Write `scripts/sync-i18n.mjs`:

```js
// Copy any keys present in en.json but missing in other locales,
// preserving existing translations and key order.
// Run: node scripts/sync-i18n.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'src', 'i18n', 'locales');
const targets = ['de', 'es', 'fr', 'uz', 'ar'];

function deepMergeMissing(source, target) {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return target === undefined ? source : target;
  }
  const out = {};
  for (const key of Object.keys(source)) {
    if (key in (target ?? {})) {
      out[key] = deepMergeMissing(source[key], target[key]);
    } else {
      out[key] = source[key];
    }
  }
  // Preserve any extra keys the target had that source did not (defensive).
  if (target && typeof target === 'object') {
    for (const key of Object.keys(target)) {
      if (!(key in out)) out[key] = target[key];
    }
  }
  return out;
}

const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'));

for (const lang of targets) {
  const path = join(localesDir, `${lang}.json`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const merged = deepMergeMissing(en, data);
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`synced ${lang}.json`);
}
```

- [ ] **Step 2: Run the sync script**

Run: `node scripts/sync-i18n.mjs`
Expected output:
```
synced de.json
synced es.json
synced fr.json
synced uz.json
synced ar.json
```

- [ ] **Step 3: Verify all locales now match `en.json` key set**

Run:
```bash
node -e "
const fs = require('fs');
const flat = (o, p='') => Object.entries(o).flatMap(([k,v]) => typeof v === 'object' && v !== null ? flat(v, p+k+'.') : [p+k]);
const en = flat(JSON.parse(fs.readFileSync('src/i18n/locales/en.json','utf8')));
for (const lang of ['de','es','fr','uz','ar']) {
  const k = flat(JSON.parse(fs.readFileSync('src/i18n/locales/'+lang+'.json','utf8')));
  const missing = en.filter(x => !k.includes(x));
  console.log(lang+': '+missing.length+' missing');
}"
```
Expected: every locale prints `0 missing`.

- [ ] **Step 4: Sanity-check by spot reading one of the synced files**

Run: `grep -c "telegramMergeTitle" src/i18n/locales/de.json`
Expected: `1`.

- [ ] **Step 5: Verify build still works**

Run: `./node_modules/.bin/vite build`
Expected: build succeeds, no JSON parse errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-i18n.mjs src/i18n/locales/de.json src/i18n/locales/es.json src/i18n/locales/fr.json src/i18n/locales/uz.json src/i18n/locales/ar.json
git commit -m "chore(i18n): sync de/es/fr/uz/ar with en.json fork-specific keys

Adds the 34 keys per locale that were missing relative to en.json
(dashboard, mono-service, OIDC bind/unbind, merge-request flow,
login-already-in-use hint). Each missing key gets its English value
so non-RU users no longer see a Russian fallback for fork-specific
strings. scripts/sync-i18n.mjs is committed for re-running on
future en.json changes."
```

---

## Task 7: Bump version + final verification

**Why:** Mark this as a separate point release so the GHCR-published image is identifiable.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Bump `package.json` version 2.8.0 → 2.8.1**

Open `package.json`, find:

```json
  "version": "2.8.0",
```

Change to:

```json
  "version": "2.8.1",
```

- [ ] **Step 2: Sync `package-lock.json`**

Run: `npm install --package-lock-only`
Expected: `package-lock.json` `version` field updated to 2.8.1, no new dep changes.

- [ ] **Step 3: Final type-check + build + lint**

Run: `./node_modules/.bin/tsc -b --noEmit && ./node_modules/.bin/vite build && npm run lint`
Expected: tsc clean, build succeeds with split chunks (vendor + per-page + per-modal), lint warnings only (no errors). Eyeball the build output:

```bash
ls -la dist/assets/*.js | wc -l
```
Expected: 8 or more JS files (vendor-react, vendor-mantine, vendor-icons, vendor-i18n, vendor-misc, main index, plus per-page and per-modal chunks).

```bash
ls -la dist/assets/*.js | awk '{print $5, $9}' | sort -n
```
Expected: largest single chunk well under 500 KB; cumulative total can be larger than the previous monolithic bundle (each chunk has a small overhead) but first-paint payload is much smaller.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 2.8.1

Quick-wins release: code-split routes & modals, restored ESLint
flat config, OIDC popup-poll cleanup on unmount, full en.json
parity for de/es/fr/uz/ar locales."
```

- [ ] **Step 5: Tag the release locally**

Run:
```bash
git tag -a 2.8.1 -m "Release 2.8.1: quick-wins (code-splitting, eslint, OIDC leak fix, i18n parity)"
git tag --points-at HEAD
```
Expected last line: `2.8.1`. Do **not** push yet — wait for explicit user confirmation, same as 2.8.0.

---

## Out of scope (intentionally not in this plan)

These came up during the audit but require their own spec:
- Decomposition of `App.tsx` (620 lines) and `config.ts` (~80 fields) — touches a lot, deserves its own plan.
- Adding `vitest` + first unit tests for `utils/services.ts`, `hooks/useEmailRequired.ts`, `api/cookie.ts`.
- Removing inline `t('key', 'fallback string')` antipattern (~6 sites).
- Server-side response handling in `OrderServiceModal.handleChange` (`data[0].msg !== 'Successful'`).
