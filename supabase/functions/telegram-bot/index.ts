// Edge Function: telegram-bot (v2.0 — چندکاربری)
// مسیر: supabase/functions/telegram-bot/index.ts
// دیپلوی: supabase functions deploy telegram-bot --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const TELEGRAM_API = "https://api.telegram.org/bot" + BOT_TOKEN;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// تبدیل ارقام فارسی/عربی به لاتین
function toLatin(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return s
    .replace(/[\u06F0-\u06F9]/g, (d: string) => String(fa.indexOf(d)))
    .replace(/[\u0660-\u0669]/g, (d: string) => String(ar.indexOf(d)));
}

async function tg(chatId: number, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    await fetch(TELEGRAM_API + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("tg error:", e);
  }
}

function mainMenu() {
  return {
    keyboard: [
      [{ text: "📊 مانده من" }, { text: "📋 تراکنش‌ها" }],
      [{ text: "🔗 اتصال با کد" }, { text: "❓ راهنما" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
  };
}

function txnCountKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "۱۰ اخیر", callback_data: "txns_10" },
        { text: "۳۰ اخیر", callback_data: "txns_30" },
        { text: "همه", callback_data: "txns_all" },
      ],
    ],
  };
}

function scopeLabel(scope: string | null | undefined): string {
  if (scope === "balance_only") return "فقط مانده";
  return "فهرست تراکنش‌ها";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

interface V2Txn {
  direction: string;
  amount: number;
  currency: string;
  effective_at: string;
  description: string | null;
  counterparties: { display_name: string } | null;
}

// مانده به تفکیک طرف حساب — همان منطق engine.ts
// net = Σ(دریافت از) − Σ(پرداخت به)
// receivable = max(−net, 0) → طلب من از او
// payable = max(net, 0) → بدهی من به او
function computeBalances(txns: V2Txn[]) {
  const byCp = new Map<string, { name: string; received: number; paid: number }>();
  for (const t of txns) {
    const key = t.counterparties?.display_name ?? "نامشخص";
    const row = byCp.get(key) ?? { name: key, received: 0, paid: 0 };
    if (t.direction === "received_from") row.received += t.amount;
    else row.paid += t.amount;
    byCp.set(key, row);
  }
  let totalReceivable = 0;
  let totalPayable = 0;
  const rows: Array<{ name: string; receivable: number; payable: number }> = [];
  for (const r of byCp.values()) {
    const net = r.received - r.paid;
    const receivable = Math.max(-net, 0);
    const payable = Math.max(net, 0);
    totalReceivable += receivable;
    totalPayable += payable;
    rows.push({ name: r.name, receivable, payable });
  }
  rows.sort((a, b) => (b.receivable + b.payable) - (a.receivable + a.payable));
  return { rows, totalReceivable, totalPayable };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // اعتبارسنجی وب‌هوک (اختیاری — اگر TELEGRAM_WEBHOOK_SECRET ست شده باشد)
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (got !== WEBHOOK_SECRET) return json({ error: "Forbidden" }, 403);
  }

  let update: any;
  try { update = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ===== Callback Query (دکمه‌های شیشه‌ای) =====
  if (update.callback_query) {
    const cbId = update.callback_query.id;
    const cbChatId = update.callback_query.message?.chat?.id;
    const cbData = update.callback_query.data;
    const cbUserId = update.callback_query.from?.id;

    try {
      await fetch(TELEGRAM_API + "/answerCallbackQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId }),
      });
    } catch {}

    if (cbData?.startsWith("txns_")) {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("user_id")
        .eq("telegram_user_id", cbUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        if (cbChatId) await tg(cbChatId, "❌ حساب شما متصل نیست.", mainMenu());
        return json({ ok: true });
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, telegram_enabled")
        .eq("id", link.user_id)
        .maybeSingle();
      if (profile?.telegram_enabled === false) {
        if (cbChatId) await tg(cbChatId,
          "⛔ ادمین سامانه دسترسی تلگرام شما را غیرفعال کرده است.",
          mainMenu()
        );
        return json({ ok: true });
      }
      if (profile?.scope === "balance_only") {
        if (cbChatId) await tg(cbChatId,
          "⚠️ سطح دسترسی شما «فقط مانده» است و اجازه مشاهده تراکنش‌ها را ندارید.\n" +
          "برای مشاهده مانده: دکمه «📊 مانده من» را بزنید.",
          mainMenu()
        );
        return json({ ok: true });
      }
      const limit = cbData === "txns_all" ? 500 : parseInt(cbData.split("_")[1] ?? "10", 10);
      const { data: txns } = await supabase
        .from("transactions")
        .select("direction, amount, currency, effective_at, description, counterparties(display_name)")
        .eq("user_id", link.user_id)
        .eq("status", "POSTED")
        .order("created_at", { ascending: false })
        .limit(limit);
      const txList = (txns ?? []) as V2Txn[];
      if (txList.length === 0) {
        if (cbChatId) await tg(cbChatId, "📭 تراکنشی برای نمایش وجود ندارد.", mainMenu());
        return json({ ok: true });
      }
      const currency = txList[0]?.currency || "IRT";
      const label = currency === "IRT" ? "تومان" : "ریال";
      let msg = "📋 <b>تراکنش‌های شما</b> (" + (cbData === "txns_all" ? "همه" : String(limit)) + " مورد — جدید به قدیم)\n\n";
      for (const t of txList) {
        const cp = t.counterparties?.display_name ?? "نامشخص";
        if (t.direction === "paid_to") {
          msg += "🟥 پرداخت به <b>" + cp + "</b>: " + fmt(t.amount) + " " + label + " | " + t.effective_at;
        } else {
          msg += "🟩 دریافت از <b>" + cp + "</b>: " + fmt(t.amount) + " " + label + " | " + t.effective_at;
        }
        if (t.description) msg += " | " + t.description;
        msg += "\n";
      }
      if (cbChatId) await tg(cbChatId, msg, mainMenu());
    }
    return json({ ok: true });
  }

  // ===== پیام‌های معمولی =====
  const message = update.message;
  if (!message || !message.chat || !message.from) return json({ ok: true });
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const telegramUserId = message.from.id;
  const telegramUsername = message.from.username;

  try {
    // ===== /start =====
    if (text === "/start") {
      await tg(chatId,
        "👋 سلام!\n\n" +
        "این ربات برای مشاهده مانده بدهی و طلب شماست.\n\n" +
        "📝 <b>چه کار کنید:</b>\n" +
        "۱. از ادمین سامانه کد اتصال ۶ رقمی بگیرید.\n" +
        "۲. کد ۶ رقمی را همین‌جا بفرستید (یا <code>/link 123456</code>).\n" +
        "۳. بعد از اتصال، دکمه «📊 مانده من» را بزنید.\n\n" +
        "دستورها: <code>/balance</code> ، <code>/transactions</code> ، <code>/help</code>",
        mainMenu()
      );
      return json({ ok: true });
    }

    // ===== اتصال با کد =====
    const isLinkButton = text === "🔗 اتصال با کد";
    const latinText = toLatin(text);
    const isSixDigits = /^\d{6}$/.test(latinText);
    const isLinkCommand = text.startsWith("/link ");

    if (isLinkButton) {
      await tg(chatId,
        "🔗 برای اتصال:\n" +
        "۱. از ادمین سامانه کد اتصال ۶ رقمی بگیرید.\n" +
        "۲. کد ۶ رقمی را همین‌جا بفرستید.\n" +
        "مثال: <code>123456</code> یا <code>/link 123456</code>",
        mainMenu()
      );
      return json({ ok: true });
    }

    if (isLinkCommand || isSixDigits) {
      const rawCode = isLinkCommand ? text.replace("/link", "").trim() : text;
      const code = toLatin(rawCode);
      if (!/^\d{6}$/.test(code)) {
        await tg(chatId, "❌ کد باید ۶ رقم باشد. مثال: <code>/link 123456</code>", mainMenu());
        return json({ ok: true });
      }
      const { data: linkCode } = await supabase
        .from("telegram_link_codes")
        .select("id, user_id")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!linkCode) {
        await tg(chatId, "❌ کد نامعتبر، منقضی یا قبلاً استفاده شده است.\nکد جدید را از ادمین سامانه بگیرید.", mainMenu());
        return json({ ok: true });
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, scope, telegram_enabled")
        .eq("id", linkCode.user_id)
        .maybeSingle();
      if (!profile) {
        await tg(chatId, "❌ پروفایل کاربر پیدا نشد. با ادمین تماس بگیرید.", mainMenu());
        return json({ ok: true });
      }
      if (profile.telegram_enabled === false) {
        await tg(chatId, "⛔ ادمین دسترسی تلگرام شما را غیرفعال کرده است. برای فعال‌سازی با ادمین تماس بگیرید.", mainMenu());
        return json({ ok: true });
      }
      // کد مصرف شد
      await supabase
        .from("telegram_link_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", linkCode.id);
      // اتصال — هر تلگرام فقط به یک کاربر؛ اتصال قبلی همان تلگرام جایگزین می‌شود
      await supabase
        .from("telegram_links")
        .upsert({
          telegram_user_id: telegramUserId,
          user_id: linkCode.user_id,
          telegram_username: telegramUsername ? "@" + telegramUsername : null,
          status: "linked",
          linked_at: new Date().toISOString(),
        }, { on_conflict: "telegram_user_id" });
      await tg(chatId,
        "✅ اتصال موفق بود!\n\n" +
        "نام کاربر: <b>" + profile.display_name + "</b>\n" +
        "سطح دسترسی: " + scopeLabel(profile.scope) + "\n\n" +
        "حالا دکمه «📊 مانده من» را بزنید.",
        mainMenu()
      );
      return json({ ok: true });
    }

    // ===== مانده و تراکنش‌ها =====
    const isBalance = text === "/balance" || text === "📊 مانده من";
    const isTransactions = text === "/transactions" || text === "📋 تراکنش‌ها";

    if (isBalance || isTransactions) {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("user_id")
        .eq("telegram_user_id", telegramUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        await tg(chatId,
          "❌ حساب شما متصل نیست.\n" +
          "دکمه «🔗 اتصال با کد» را بزنید.",
          mainMenu()
        );
        return json({ ok: true });
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("scope, telegram_enabled")
        .eq("id", link.user_id)
        .maybeSingle();
      const balanceOnly = profile?.scope === "balance_only";
      if (profile?.telegram_enabled === false) {
        await tg(chatId,
          "⛔ ادمین سامانه دسترسی تلگرام شما را غیرفعال کرده است.\n" +
          "برای فعال‌سازی با ادمین تماس بگیرید.",
          mainMenu()
        );
        return json({ ok: true });
      }

      const { data: txns } = await supabase
        .from("transactions")
        .select("direction, amount, currency, effective_at, description, counterparties(display_name)")
        .eq("user_id", link.user_id)
        .eq("status", "POSTED")
        .order("created_at", { ascending: false });
      const txList = (txns ?? []) as V2Txn[];
      const { rows, totalReceivable, totalPayable } = computeBalances(txList);
      const currency = (txList[0]?.currency) || "IRT";
      const label = currency === "IRT" ? "تومان" : "ریال";

      let msg = "📊 <b>مانده شما</b>\n\n";
      msg += "🟢 طلب شما (به شما بدهکارند): <b>" + fmt(totalReceivable) + "</b> " + label + "\n";
      msg += "🔴 بدهی شما (به آن‌ها بدهکارید): <b>" + fmt(totalPayable) + "</b> " + label + "\n";

      if (isTransactions && balanceOnly) {
        msg += "\n⚠️ سطح دسترسی شما «فقط مانده» است و اجازه مشاهده تراکنش‌ها را ندارید.";
        await tg(chatId, msg, mainMenu());
        return json({ ok: true });
      }

      if (isBalance) {
        if (!balanceOnly && rows.length > 0) {
          msg += "\n<b>به تفکیک طرف حساب:</b>\n";
          for (const r of rows.slice(0, 10)) {
            if (r.receivable > 0) msg += "• " + r.name + ": طلب " + fmt(r.receivable) + "\n";
            else if (r.payable > 0) msg += "• " + r.name + ": بدهی " + fmt(r.payable) + "\n";
            else msg += "• " + r.name + ": تسویه ✅\n";
          }
        }
        msg += "\nبرای مشاهده تراکنش‌ها، دکمه «📋 تراکنش‌ها» را بزنید.";
        await tg(chatId, msg, mainMenu());
        return json({ ok: true });
      }

      // تراکنش‌ها — انتخاب تعداد
      msg += "\nتعداد تراکنش مورد نظر را انتخاب کنید:";
      await tg(chatId, msg, txnCountKeyboard());
      return json({ ok: true });
    }

    // ===== راهنما =====
    if (text === "/help" || text === "❓ راهنما") {
      await tg(chatId,
        "📖 <b>راهنما</b>\n\n" +
        "📊 <b>مانده من</b> — کل طلب و بدهی شما\n" +
        "📋 <b>تراکنش‌ها</b> — فهرست تراکنش‌ها (طبق سطح دسترسی)\n" +
        "🔗 <b>اتصال با کد</b> — اتصال با کد ۶ رقمی که ادمین به شما می‌دهد\n" +
        "❓ <b>راهنما</b> — همین پیام\n\n" +
        "دستورها: <code>/start</code> ، <code>/link 123456</code> ، <code>/balance</code> ، <code>/transactions</code> ، <code>/help</code>",
        mainMenu()
      );
      return json({ ok: true });
    }

    // ===== پیام نامشخص =====
    await tg(chatId,
      "❓ پیام شما را متوجه نشدم.\n" +
      "دکمه «❓ راهنما» را بزنید یا <code>/help</code> را تایپ کنید.",
      mainMenu()
    );
    return json({ ok: true });
  } catch (e) {
    console.error("Bot error:", e);
    await tg(chatId, "⚠️ خطای سرور. بعداً تلاش کنید.", mainMenu());
    return json({ ok: true });
  }
});
