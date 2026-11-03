# دفتر حسابداری — نسخه ۲.۰ (چندکاربری + تطابق خودکار)

این بسته شامل **همه‌ی فایل‌های لازم برای دیپلوی کامل** است:

```
📁 محتویات این بسته
├── src/                                ← کد frontend (Next.js) — جایگزین src/ قبلی
├── supabase/
│   ├── schema-v2.sql                   ← گام ۱: ساختار کامل دیتابیس (شامل جدول‌های تلگرام)
│   ├── telegram-schema.sql             ← گام ۷: افزودنی تلگرام برای نصب‌های موجود
│   ├── config.toml                     ← پیکربندی Supabase CLI
│   └── functions/
│       ├── create-transaction/index.ts ← گام ۳: Edge Function ثبت تراکنش + تطابق
│       ├── admin-users/index.ts        ← گام ۳: Edge Function مدیریت کاربران
│       ├── admin-counterparties/index.ts ← گام ۳: Edge Function مدیریت طرف حساب‌ها
│       └── telegram-bot/index.ts       ← گام ۷: ربات استعلام تلگرام (اختیاری)
├── .env.example                        ← گام ۵: نمونه متغیرهای محیط
├── package.json و فایل‌های پیکربندی
└── README-v2.md                        ← همین راهنما
```

---

## ✅ قبل از شروع — پیش‌نیازها

| پیش‌نیاز | از کجا بگیرید |
|---|---|
| اکانت Supabase | [supabase.com](https://supabase.com) — پروژه شما: `npmbfmbxjjvrnfapvaik` |
| اکانت GitHub و Vercel | github.com و vercel.com |
| Node.js نسخه ۱۸ یا بالاتر | [nodejs.org](https://nodejs.org) → نسخه LTS را نصب کنید |
| VSCode | code.visualstudio.com |

**آزمون آمادگی:** در VSCode ترمینال باز کنید (`Ctrl + ù`) و بزنید `node -v` — باید عددی ۱۸ یا بالاتر نشان دهد.

## 📂 نصب فایل‌ها

۱. محتوای این zip را **داخل ریشه پروژه قبلی** extract کنید (پوشه‌های `src/` و `supabase/` جایگزین/اضافه شوند).
۲. در VSCode پوشه پروژه را باز کنید و ترمینال را باز کنید (`Ctrl + ù`).
۳. یک‌بار وابستگی‌ها را نصب کنید:

```bash
npm install
```

---

## گام ۱ — اجرای SQL Schema (در مرورگر — Supabase Dashboard)

۱. وارد [supabase.com](https://supabase.com) شوید و پروژه را باز کنید.
۲. از منوی چپ: **SQL Editor → New query**.
۳. فایل `supabase/schema-v2.sql` را از VSCode باز کنید → `Ctrl+A` → `Ctrl+C` → در SQL Editor بچسبانید (`Ctrl+V`).
۴. دکمه **Run** (یا `Ctrl+Enter`) را بزنید تا پیام **Success** بیاید.

این اسکریپت جداول `user_profiles`، `counterparties`، `transactions`، `audit_logs` + RLS + تابع‌های `is_admin` و `make_admin` را می‌سازد.

> ⚠️ داده‌های نسخه ۱ پاک می‌شوند (با v2 ناسازگار بودند). کاربران احرازشده در Auth حفظ می‌شوند.

## گام ۲ — ساخت کاربر ادمین (در مرورگر — Supabase Dashboard)

۱. **Authentication → Users → Add user → Create new user**
   - ایمیل: `vahid@accounting.local`
   - رمز: `1234` (یا هر رمزی که بعداً با همان وارد شوید)
   - ✅ تیک **Auto Confirm User** حتماً روشن باشد → **Create user**
۲. روی ردیف کاربر کلیک کنید و **UUID** او را کپی کنید (رشته طولانی کنار ID).
۳. به **SQL Editor** برگردید و اجرا کنید:

```sql
select public.make_admin('UUID-کپی-شده-اینجا', 'vahid', 'وحید');
```

✅ حالا می‌توانید در اپ با `vahid` / `1234` وارد شوید.

## گام ۳ — دیپلوی سه Edge Function (در ترمینال VSCode)

فایل‌های هر سه تابع **از قبل داخل پوشه `supabase/functions/` هستند** — نیازی به ساخت پوشه یا کپی کد نیست. در ترمینال VSCode این دستورات را **یکی‌یکی** اجرا کنید:

```bash
# یک‌بار: نصب CLI و اتصال به پروژه
npm install -g supabase
supabase login
# (مرورگر باز می‌شود؛ با اکانت Supabase لاگین کنید)

supabase link --project-ref npmbfmbxjjvrnfapvaik

# دیپلوی هر سه تابع
supabase functions deploy create-transaction
supabase functions deploy admin-users
supabase functions deploy admin-counterparties
```

✅ در **Dashboard → Edge Functions** هر سه تابع با وضعیت Active دیده می‌شوند.

> روش جایگزین (بدون CLI): در Dashboard → Edge Functions → Create function، کد هر فایل `index.ts` را بچسبانید.

## گام ۴ — بررسی دیپلوی (Secret دیگر لازم نیست!)

> 💡 **نکته مهم:** نسخه‌های جدید Supabase CLI کلید `SUPABASE_SERVICE_ROLE_KEY` را به‌صورت **خودکار** داخل هر تابع تزریق می‌کنند و اجازه نمی‌دهند دستی ستش کنید. اگر هنگام `secrets set` پیام «Env name cannot start with SUPABASE_, skipping» دیدید، **کاملاً طبیعی است** — یعنی کلید از قبل موجود است و این گام کلاً حذف شده.

فقط در مرورگر بررسی کنید:

۱. **Dashboard → Edge Functions** (از منوی چپ)
۲. باید هر سه تابع را ببینید: `create-transaction` ، `admin-users` ، `admin-counterparties`
۳. وضعیت هر سه **Active** باشد

✅ توابع آماده‌اند — به گام ۵ بروید.

## گام ۵ — انتقال پروژه به GitHub و Vercel

۱. در ترمینال VSCode از ریشه پروژه:

```bash
git add .
git commit -m "v2.0 - multi-user + auto-matching"
git push
```

۲. در **Vercel → پروژه → Settings → Environment Variables → Add New** این دو را اضافه کنید:

| نام متغیر | مقدار — از کجا کپی کنید |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → **Project Settings → API** → قسمت **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | همان صفحه → کلید **anon public** (نه service_role!) |

۳. در Vercel تب **Deployments** → روی «⋯» آخرین دیپلوی → **Redeploy**.

✅ با وجود این دو متغیر، اپ در حالت real (اتصال به Supabase) اجرا می‌شود.

## گام ۶ — تست تطابق خودکار

۱. وارد اپ شوید: `vahid` / `1234`
۲. منو ☰ → **مدیریت ادمین** → کاربر بسازید: `faezeh` با رمز `1234` (طرف حساب لینک‌شده خودکار ساخته می‌شود).
۳. با vahid ثبت کنید: «پرداخت به فائزه ۱٬۰۰۰٬۰۰۰» → وضعیت: **در انتظار تأیید** ⏳
۴. خروج → با `faezeh` / `1234` وارد شوید → «دریافت از وحید ۱٬۰۰۰٬۰۰۰» (هم مبلغ، هم تاریخ).
۵. هر دو تراکنش خودکار **تطبیق‌یافته** ✅ می‌شوند و زوج‌شان در فهرست کنار هم نمایش داده می‌شود.

## گام ۷ — ربات استعلام تلگرام (اختیاری)

رباتی که هر کاربر با کد ۶ رقمی که «ادمین» به او می‌دهد تلگرامش را وصل می‌کند و مانده خودش را می‌بیند.
**ساخت کد فقط از منوی «مدیریت» ← بخش «اتصال تلگرام کاربران» انجام می‌شود** — ادمین تصمیم می‌گیرد کدام کاربر کد بگیرد:

۱. **اجرای SQL تلگرام** (برای همه نصب‌ها لازم است — به داده‌های قبلی آسیب نمی‌زند): فایل `supabase/telegram-schema.sql` را در SQL Editor اجرا کنید. این فایل دسترسی ادمین به کدها و ستون `telegram_enabled` را هم اضافه می‌کند.
۲. **ساخت ربات**: در تلگرام به **@BotFather** → `/newbot` → نام و username بدهید (به bot ختم شود) → **توکن** را کپی کنید.
۳. **دیپلوی تابع ربات** (ترمینال VSCode):

```bash
supabase functions deploy telegram-bot --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=توکن-کپی-شده
```

۴. **فعال‌سازی webhook** — این آدرس را در مرورگر باز کنید (توکن خودتان):

```
https://api.telegram.org/botتوکن-شما/setWebhook?url=https://npmbfmbxjjvrnfapvaik.supabase.co/functions/v1/telegram-bot
```

باید پاسخ `{"ok":true}` بدهد.

۵. **ساخت کد برای کاربر (در اپ)**: با vahid وارد شوید → منو ☰ → **مدیریت** → بخش **«اتصال تلگرام کاربران»** → کنار کاربر دکمه **«ساخت کد اتصال»** → کد ۶ رقمی نمایش داده می‌شود → **«کپی کد»** → کد را به کاربر بدهید.
   - کلید **«اجازه اتصال»**: با خاموش‌کردنش، ربات حتی اگر کاربر متصل باشد به او پاسخ نمی‌دهد.
   - دکمه **«قطع اتصال»**: لینک تلگرام کاربر را حذف می‌کند (برای وصل‌شدن دوباره، کد جدید لازم دارد).
۶. **تست**: کاربر کد را در ربات می‌فرستد → «✅ اتصال موفق» → دکمه «📊 مانده من».

> ⚠️ توکن ربات را به GitHub ندهید (Secret فقط در Supabase).
> قابلیت‌های ربات: مانده کل + تفکیک طرف حساب‌ها، فهرست تراکنش‌ها (۱۰/۳۰/همه)، سطح دسترسی از پروفایل کاربر پیروی می‌کند، دسترسی کل تلگرام هر کاربر قابل قطع توسط ادمین است.

---

## 🔧 رفع اشکال

**«دکمه ورود کار نمی‌کند» یا «ورود ناموفق»**
- در حالت real (روی Vercel)، ورود فقط بعد از **گام ۱ و ۲** کار می‌کند — چون باید کاربر در Supabase Auth ساخته شده باشد.
- مطمئن شوید در گام ۲ ایمیل دقیقاً `vahid@accounting.local` و تیک Auto Confirm زده شده باشد.
- ارقام فارسی (۱۲۳۴) هم پذیرفته می‌شوند — نیازی به تغییر کیبورد نیست.

**«relation does not exist» یا خطای ۴۲۷۰۳ در SQL**
- یعنی schema قدیمی v1 باقی مانده؛ اسکریپت v2 خودش اول جداول قدیمی را حذف می‌کند — کل فایل را از اول کامل Run کنید.

**«npm is not recognized»**
- Node.js نصب نیست — از nodejs.org نسخه LTS را نصب کنید و VSCode را ببندید و دوباره باز کنید.

**خطای `No matching Supabase CLI binary package found for win32-x64` هنگام `supabase login`**
- پکیج npm باینری ویندوز را درست نگرفته (مشکل شناخته‌شده npm روی ویندوز، مخصوصاً با Nodeهای خیلی جدید). سریع‌ترین راه: دانلود مستقیم فایل اجرایی — در PowerShell از ریشه پروژه (حدود ۶۵ مگابایت، کمی صبر کنید):

```powershell
Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/download/v2.122.0/supabase_2.122.0_windows_amd64.zip" -OutFile "supabase-cli.zip" -UseBasicParsing
Expand-Archive -Path "supabase-cli.zip" -DestinationPath "." -Force
Remove-Item "supabase-cli.zip"

# حالا بجای دستور supabase از .\supabase.exe استفاده کنید:
.\supabase.exe --version
.\supabase.exe login
.\supabase.exe link --project-ref npmbfmbxjjvrnfapvaik
.\supabase.exe functions deploy create-transaction
.\supabase.exe functions deploy admin-users
.\supabase.exe functions deploy admin-counterparties
```

> ✅ گام `secrets set` حذف شد — CLI جدید کلید service_role را خودکار تزریق می‌کند.

> اگر بعداً این URL خطای 404 داد (نسخه جدیدتر آمده)، شماره نسخه را از آدرس `github.com/supabase/cli/releases/latest` بردارید و در URL بجای `v2.122.0` بگذارید؛ یا روش جایگزین:
> `Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz" -OutFile "supabase.tar.gz" -UseBasicParsing` بعد `tar -xzf supabase.tar.gz` بعد `Remove-Item supabase.tar.gz`

- ⚠️ فایل `supabase.exe` را به GitHub ندهید — قبل از `git add .` این را اجرا کنید:

```powershell
Add-Content .gitignore "supabase.exe"
```

- راه دوم (تلاش مجدد npm): `npm uninstall -g supabase` بعد `npm cache clean --force` بعد `npm install -g supabase`

**پیام «Env name cannot start with SUPABASE_, skipping» هنگام secrets set**
- خطا نیست! نسخه‌های جدید CLI کلیدهای شروع‌شده با `SUPABASE_` را خودکار داخل توابع تزریق می‌کنند و اجازه ست دستی نمی‌دهند. این گام کلاً حذف شده — ادامه بدهید به گام ۵.

**Edge Functions خطای ۵۰۰ می‌دهند**
- لاگ تابع را ببینید: Dashboard → Edge Functions → روی تابع کلیک کنید → تب Logs. معمولاً یعنی تابع با CLI جدید دیپلوی نشده یا اسم تابع با اسمی که frontend صدا می‌زند فرق دارد.

---

**ربات تلگرام جواب نمی‌دهد / webhook خطا می‌دهد**
- آدرس webhook باید دقیقاً `https://REF.supabase.co/functions/v1/telegram-bot` باشد و تابع با `--no-verify-jwt` دیپلوی شده باشد.
- توکن ربات را با `supabase secrets set TELEGRAM_BOT_TOKEN=...` ست کنید (این اسم با SUPABASE_ شروع نمی‌شود، پس مشکلی ندارد).
- وضعیت webhook: آدرس `https://api.telegram.org/botتوکن/getWebhookInfo` را در مرورگر باز کنید.

**ورود با username چطور کار می‌کند؟**

Supabase Auth فقط email می‌پذیرد؛ پس کلاینت به‌صورت خودکار `email = username + "@accounting.local"` می‌سازد و `signInWithPassword` می‌زند. username واقعی در جدول `user_profiles` ذخیره می‌شود.

## حساب‌های نمایشی (فقط حالت mock — بدون env vars)

`vahid/1234` — `faezeh/1234` — `maryam/1234`
