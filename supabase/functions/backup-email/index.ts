// supabase/functions/backup-email/index.ts
// بک‌آپ خودکار روزانه به ایمیل — نسخه ۳.۷
// ============================================================
// POST /backup-email
//   - با JWT کاربر (ادمین) → بک‌آپ دستی
//   - با X-Backup-Secret → بک‌آپ زمان‌بندی‌شده (cron)
//
// نیازها:
//   - RESEND_API_KEY (Resend.com — رایگان تا ۳۰۰۰ ایمیل/ماه)
//   - BACKUP_EMAIL_TO  (ایمیل گیرنده)
//   - BACKUP_EMAIL_FROM (ایمیل فرستنده — باید در Resend تأیید شده باشد)
//   - BACKUP_WEBHOOK_SECRET (برای فراخوانی زمان‌بندی‌شده)
//
// Deploy: supabase functions deploy backup-email --no-verify-jwt
//
// زمان‌بندی روزانه (با pg_cron + pg_net):
//   -- ۱) افزونه‌ها را فعال کنید (یک‌بار، در SQL Editor):
//   create extension if not exists pg_cron;
//   create extension if not exists pg_net;
//   -- ۲) زمان‌بندی (هر روز ساعت ۰۲:۰۰ به وقت تهران = ۲۲:۳۰ UTC):
//   select cron.schedule(
//     'daily-backup-email',
//     '30 22 * * *',
//     $$select net.http_post(
//       url := 'https://npmbfmbxjjvrnfapvaik.functions.supabase.co/backup-email',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'X-Backup-Secret', 'PUT_YOUR_SECRET_HERE'
//       ),
//       body := jsonb_build_object('scheduled', true)::text
//     )$$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backup-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface BackupData {
  meta: {
    version: string;
    generatedAt: string;
    projectRef: string;
    scheduledBy: string;
    tables: string[];
    rowCounts: Record<string, number>;
  };
  user_profiles: any[];
  counterparties: any[];
  transactions: any[];
  categories: any[];
  transaction_comments: any[];
  counterparty_access: any[];
  audit_logs: any[];
  telegram_links?: any[];
}

async function collectBackup(
  admin: ReturnType<typeof createClient>,
  projectRef: string,
  scheduledBy: string
): Promise<BackupData> {
  const [users, cps, txns, cats, comments, grants, audit, tg] =
    await Promise.all([
      admin.from("user_profiles").select("*").order("created_at"),
      admin.from("counterparties").select("*").order("created_at"),
      admin.from("transactions").select("*").order("created_at", { ascending: false }),
      admin.from("categories").select("*").order("created_at"),
      admin.from("transaction_comments").select("*").order("created_at"),
      admin.from("counterparty_access").select("*").order("created_at"),
      admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5000),
      admin.from("telegram_links").select("*").order("linked_at", { ascending: false }),
    ]);

  const tables = [
    "user_profiles",
    "counterparties",
    "transactions",
    "categories",
    "transaction_comments",
    "counterparty_access",
    "audit_logs",
    "telegram_links",
  ];

  const rows: Record<string, any[]> = {
    user_profiles: users.data ?? [],
    counterparties: cps.data ?? [],
    transactions: txns.data ?? [],
    categories: cats.data ?? [],
    transaction_comments: comments.data ?? [],
    counterparty_access: grants.data ?? [],
    audit_logs: audit.data ?? [],
    telegram_links: tg.data ?? [],
  };

  const rowCounts: Record<string, number> = {};
  for (const t of tables) rowCounts[t] = rows[t].length;

  return {
    meta: {
      version: "3.7.0",
      generatedAt: new Date().toISOString(),
      projectRef,
      scheduledBy,
      tables,
      rowCounts,
    },
    ...rows,
  } as BackupData;
}

function buildEmailHtml(backup: BackupData, scheduledBy: string): string {
  const rows = Object.entries(backup.meta.rowCounts)
    .map(
      ([table, count]) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${table}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;direction:ltr;">${count.toLocaleString("en-US")}</td></tr>`
    )
    .join("");

  const tehranDate = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!doctype html>
<html dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>بک‌آپ دفتر حساب کتاب</title></head>
<body style="font-family:Vazirmatn,sans-serif;background:#f9fafb;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#059669;padding:20px 24px;color:#fff;">
      <div style="font-size:18px;font-weight:700;">بک‌آپ روزانه — دفتر حساب کتاب</div>
      <div style="font-size:12px;opacity:.9;margin-top:4px;">نسخه ${backup.meta.version}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">
        بک‌آپ خودکار پایگاه‌داده شما با موفقیت تولید شد.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:right;">جدول</th>
            <th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;">تعداد ردیف</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#6b7280;margin:12px 0 0;">
        زمان تولید: ${tehranDate} (Asia/Tehran)<br>
        فراخوانی توسط: ${scheduledBy}<br>
        فایل JSON پیوست این ایمیل، شامل تمام داده‌های قابل بک‌آپ است.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmailWithResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: string };
}): Promise<void> {
  // Resend API نیاز به فرمت multipart/form-data دارد وقتی فایل پیوست داریم.
  // برای سادگی، از Base64 در content استفاده می‌کنیم.
  const boundary = "----zbackup" + Math.random().toString(36).slice(2);
  const base64Content = btoa(unescape(encodeURIComponent(opts.attachment.content)));

  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="from"`,
    "",
    opts.from,
    `--${boundary}`,
    `Content-Disposition: form-data; name="to"`,
    "",
    opts.to,
    `--${boundary}`,
    `Content-Disposition: form-data; name="subject"`,
    "",
    opts.subject,
    `--${boundary}`,
    `Content-Disposition: form-data; name="html"`,
    "",
    opts.html,
    `--${boundary}`,
    `Content-Disposition: form-data; name="attachments[0][filename]"`,
    "",
    opts.attachment.filename,
    `--${boundary}`,
    `Content-Disposition: form-data; name="attachments[0][content]"`,
    "",
    base64Content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend API خطا (${res.status}): ${txt}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return json({ error: "متد پشتیبانی نمی‌شود" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const BACKUP_EMAIL_TO = Deno.env.get("BACKUP_EMAIL_TO");
    const BACKUP_EMAIL_FROM = Deno.env.get("BACKUP_EMAIL_FROM");
    const BACKUP_WEBHOOK_SECRET = Deno.env.get("BACKUP_WEBHOOK_SECRET");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "متغیرهای Supabase تنظیم نشده" }, 500);
    }

    // تعیین نحوه احراز هویت: JWT کاربر یا webhook secret
    const authHeader = req.headers.get("Authorization") ?? "";
    const webhookSecret = req.headers.get("X-Backup-Secret") ?? "";

    let actorId: string;
    let actorName: string;
    let scheduledBy: string;

    if (webhookSecret && BACKUP_WEBHOOK_SECRET && webhookSecret === BACKUP_WEBHOOK_SECRET) {
      // فراخوانی زمان‌بندی‌شده — نیازی به JWT کاربر نیست
      actorId = "cron";
      actorName = "زمان‌بندی خودکار";
      scheduledBy = "scheduled-cron";
    } else if (authHeader.startsWith("Bearer ")) {
      // فراخوانی دستی با JWT کاربر
      const userClient = createClient(SUPABASE_URL, ANON_KEY!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "احراز هویت نشده" }, 401);

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: prof } = await admin
        .from("user_profiles")
        .select("role, is_active, display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof || prof.role !== "admin" || prof.is_active === false) {
        return json({ error: "فقط ادمین می‌تواند بک‌آپ بگیرد" }, 403);
      }
      actorId = user.id;
      actorName = prof.display_name || "ادمین";
      scheduledBy = `manual-${actorId.slice(0, 8)}`;
    } else {
      return json({ error: "احراز هویت نامعتبر — JWT یا X-Backup-Secret الزامی است" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // پروژه ref از URL استخراج می‌شود
    const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];

    // جمع‌آوری داده
    const backup = await collectBackup(admin, projectRef, scheduledBy);
    const backupJson = JSON.stringify(backup, null, 2);

    // اگر ایمیل تنظیم نشده، فقط JSON را برمی‌گردانیم (حالت دستی بدون ایمیل)
    if (!RESEND_API_KEY || !BACKUP_EMAIL_TO || !BACKUP_EMAIL_FROM) {
      // بک‌آپ دستی بدون ارسال ایمیل — فقط داده را برمی‌گرداند
      return json({
        ok: true,
        backup: backup,
        emailSent: false,
        message: "متغیرهای RESEND_API_KEY/BACKUP_EMAIL_TO/BACKUP_EMAIL_FROM تنظیم نشده — بک‌آپ بدون ارسال ایمیل",
      });
    }

    // ارسال ایمیل با فایل پیوست
    const tehranDate = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const filename = `backup-${projectRef}-${tehranDate.replace(/[/ :,]/g, "-")}.json`;

    await sendEmailWithResend({
      apiKey: RESEND_API_KEY,
      from: BACKUP_EMAIL_FROM,
      to: BACKUP_EMAIL_TO,
      subject: `بک‌آپ دفتر حساب کتاب — ${tehranDate}`,
      html: buildEmailHtml(backup, scheduledBy),
      attachment: { filename, content: backupJson },
    });

    // گزارش ممیزی
    await admin.from("audit_logs").insert({
      actor_id: actorId === "cron" ? null : actorId,
      actor_name: actorName,
      action: "BACKUP_EMAIL",
      entity_type: "Backup",
      entity_id: filename,
      result: "success",
      details: `بک‌آپ به ${BACKUP_EMAIL_TO} ارسال شد — ${backup.meta.rowCounts.transactions} تراکنش`,
    });

    return json({
      ok: true,
      emailSent: true,
      recipient: BACKUP_EMAIL_TO,
      filename,
      rowCounts: backup.meta.rowCounts,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
