# دفتر حساب کتاب — نسخه ۳.۷ (راهنمای کامل دیپلوی در VS Code)

این بسته شامل کل پروژه است. پوشه `supabase/functions/` دقیقاً با ساختار
استاندارد Supabase CLI چیده شده، پس فقط کافی است آن را جایگزین پروژه محلی
کنید و از ریشه دیپلوی بگیرید.

## ساختار پوشه supabase/ در این ZIP

```
supabase/
├── config.toml                      ← verify_jwt=false برای هر ۶ تابع
├── schema-v2.sql                    ← فقط نصب از صفر
├── telegram-schema.sql              ← فقط نصب از صفر
├── schema-v3.sql                    ← مهاجرت v3 (برای نصب موجود کافی است)
└── functions/
    ├── create-transaction/index.ts
    ├── manage-transaction/index.ts  ← ویرایش/حذف تراکنش (v3.5)
    ├── admin-users/index.ts         ← اصلاح حذف کاربر (v3.7)
    ├── admin-counterparties/index.ts
    ├── telegram-bot/index.ts
    └── backup-email/index.ts        ← بک‌آپ ایمیل (v3.7)
```

**جایگزینی فایل‌های قبلی:** کل پوشه `supabase/` را از این ZIP بردارید و روی
پوشه `supabase/` پروژه محلی کپی کنید (بگذارید بازنویسی/merge شود). هر
`index.ts` جایگزین نسخه قبلی می‌شود.

## گام ۰ — پیش‌نیازها (فقط بار اول)

در Terminal داخل VS Code:

```bash
npm install -g supabase
supabase login
supabase link --project-ref npmbfmbxjjvrnfapvaik
```

## گام ۱ — اجرای SQL مهاجرت

- Supabase Dashboard → SQL Editor → محتوای `supabase/schema-v3.sql` را Run کنید.
- این اسکریپت idempotent است؛ اجرای مجدد خطا نمی‌دهد و داده‌ها حفظ می‌شوند.
- (نصب از صفر: اول `schema-v2.sql` و `telegram-schema.sql` را اجرا کنید.)

## گام ۲ — دیپلوی هر ۶ Edge Function

**راه ساده (اسکریپت آماده):**

```bash
# لینوکس / مک / Git Bash ویندوز:
bash deploy-edge-functions.sh

# ویندوز (CMD): فایل deploy-edge-functions.bat را دابل‌کلیک کنید
```

**راه دستی (تک‌به‌تک):**

```bash
supabase functions deploy create-transaction
supabase functions deploy manage-transaction
supabase functions deploy admin-users
supabase functions deploy admin-counterparties
supabase functions deploy telegram-bot
supabase functions deploy backup-email
```

نکات:
- `verify_jwt` همه توابع از `supabase/config.toml` خوانده می‌شود (همه false).
- پیام «Env name cannot start with SUPABASE_» طبیعی است — کلید service_role
  خودکار تزریق می‌شود و نیازی به Secret اضافی نیست.
- ربات تلگرام به `TELEGRAM_BOT_TOKEN` نیاز دارد:
  `supabase secrets set TELEGRAM_BOT_TOKEN=...`

## گام ۳ — (اختیاری) بک‌آپ خودکار روزانه به ایمیل

```bash
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set BACKUP_EMAIL_FROM=backup@yourdomain.com
supabase secrets set BACKUP_EMAIL_TO=you@example.com
supabase secrets set BACKUP_WEBHOOK_SECRET=random_secret_string
```

سپس در SQL Editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('daily-backup-email', '30 22 * * *',
  $$select net.http_post(
    url := 'https://npmbfmbxjjvrnfapvaik.functions.supabase.co/backup-email',
    headers := jsonb_build_object('Content-Type','application/json','X-Backup-Secret','random_secret_string'),
    body := jsonb_build_object('scheduled',true)::text
  )$$);
```

۲۲:۳۰ UTC = ۰۲:۰۰ به وقت تهران. بدون این گام، بک‌آپ دستی از پنل ادمین
همچنان کار می‌کند.

## گام ۴ — دیپلوی فرانت‌اند روی Vercel

```bash
npm install        # نصب وابستگی‌ها (xlsx در v3.7 اضافه شده)
git add .
git commit -m "v3.7 - full deploy package"
git push origin main
```

Vercel خودکار Redeploy می‌کند. env vars قبلی همان‌ها می‌مانند
(`NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## گام ۵ — تست سریع

1. ورود vahid — نسخه فوتر باید ۳.۷ باشد.
2. ثبت/ویرایش/حذف تراکنش.
3. «مدیریت سامانه» → حذف کاربر باید واقعاً حذف کند.
4. «مدیریت سامانه» → بک‌آپ: دانلود JSON.
5. «مدیریت سامانه» → اکسل: الگو، ورود، خروجی.
6. موبایل: بدون تیک «مرا به خاطر بسپار» نباید خودکار وارد شود.

## حساب‌های نمایشی (فقط حالت mock — بدون env vars)

| کاربر | رمز | نقش |
|---|---|---|
| vahid | 1234 | ادمین |
| faezeh | 1234 | کاربر (تراکنش‌ها) |
| maryam | 1234 | کاربر (فقط مانده) |
