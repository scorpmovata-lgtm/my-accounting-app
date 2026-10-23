# دفتر حسابداری — بدهی و طلب

اپ وب PWA فارسی RTL برای مدیریت بدهی و طلب شخصی، با تقویم هجری شمسی و اتصال به Supabase.

## شروع

### پیش‌نیازها

- Node.js 18+ (دانلود از nodejs.org)
- یک پروژه Supabase (با schema از `setup-tab` اجرا شده)

### نصب

```bash
npm install
```

### اجرای dev

```bash
npm run dev
```

سپس به http://localhost:3000 برو.

### build production

```bash
npm run build
npm start
```

## استفاده

1. در تب «اتصال» URL و anon key پروژه Supabase خودت را وارد کن
2. با email + password وارد شو (کاربری که در Authentication → Users ساختی)
3. در داشبورد، تراکنش‌ها را ثبت کن — از طریق Edge Function امن

## ساختار

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # RTL + Vazirmatn font + PWA meta
│   ├── page.tsx            # رندر AppShell
│   └── globals.css         # Tailwind + theme
├── components/
│   ├── accounting/         # 9 کامپوننت UI اپ
│   ├── pwa/                # Service Worker registration
│   ├── theme-provider.tsx
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── accounting/         # types, jalali, engine, mock-data
│   ├── supabase/           # client, api
│   ├── deployment-artifacts.ts
│   └── android-artifacts.ts
├── store/
│   ├── accounting-store.ts # Zustand (mock + real mode)
│   └── auth-store.ts
└── hooks/
```

## معماری

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **PWA**: manifest.json + service worker + installable
- **Multi-client**: هم اپ وب، هم ربات تلگرام، هم اپ اندروید به همان Supabase وصل می‌شوند

## دیپلوی به Vercel

1. این مخزن را به GitHub پوش کن
2. در vercel.com → New Project → Import این مخزن
3. دکمه Deploy → URL می‌گیری

## امنیت

- `service_role` key هرگز در کلاینت نباشد
- کلاینت فقط `anon` key دارد (با RLS محدود)
- Edge Functions با `--no-verify-jwt` دیپلوی می‌شوند و JWT را در کد بررسی می‌کنند
- همه عملیات حساس در `audit_logs` ثبت می‌شوند
