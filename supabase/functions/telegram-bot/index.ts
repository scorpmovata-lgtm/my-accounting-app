// Edge Function: telegram-bot (v2 - با منوی فارسی + callback_query)
// مسیر: supabase/functions/telegram-bot/index.ts
// دیپلوی: supabase functions deploy telegram-bot --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
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
  return s
    .replace(/[۰-۹]/g, (d: string) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d: string) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
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
      [{ text: "۱۰ تراکنش اخیر", callback_data: "txns_10" }],
      [{ text: "۳۰ تراکنش اخیر", callback_data: "txns_30" }],
      [{ text: "همه تراکنش‌ها", callback_data: "txns_all" }],
    ],
  };
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "balance_only": return "فقط مانده";
    case "transaction_list": return "فهرست تراکنش‌ها";
    case "transaction_details": return "جزئیات تراکنش‌ها";
    case "category_breakdown": return "گزارش سرفصلی";
    default: return scope;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function computeBalance(txns: Array<{ transaction_type: string; amount: number }>) {
  let receivable = 0, payable = 0;
  for (const t of txns) {
    if (t.transaction_type === "RECEIVABLE_CHARGE" || t.transaction_type === "OPENING_RECEIVABLE") receivable += t.amount;
    else if (t.transaction_type === "PAYABLE_CHARGE" || t.transaction_type === "OPENING_PAYABLE") payable += t.amount;
    else if (t.transaction_type === "RECEIPT_ALLOCATION") receivable -= t.amount;
    else if (t.transaction_type === "PAYMENT_ALLOCATION") payable -= t.amount;
  }
  return { receivable, payable };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let update: any;
  try { update = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // ===== Callback Query (inline keyboard buttons) =====
  if (update.callback_query) {
    const cbId = update.callback_query.id;
    const cbChatId = update.callback_query.message?.chat?.id;
    const cbData = update.callback_query.data;
    const cbUserId = update.callback_query.from?.id;

    // answer callback
    try {
      await fetch(TELEGRAM_API + "/answerCallbackQuery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId }),
      });
    } catch {}

    if (cbData?.startsWith("txns_")) {
      const cbSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: link } = await cbSupabase
        .from("telegram_links")
        .select("contact_id, scope")
        .eq("telegram_user_id", cbUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        if (cbChatId) await tg(cbChatId, "❌ حساب شما متصل نیست.", mainMenu());
        return json({ ok: true });
      }
      const limit = cbData === "txns_all" ? 999 : parseInt(cbData.split("_")[1] ?? "10", 10);
      const { data: txns } = await cbSupabase
        .from("transactions")
        .select("transaction_type, amount, currency, effective_at, description")
        .eq("contact_id", link.contact_id)
        .eq("status", "POSTED")
        .order("effective_at", { ascending: false })
        .limit(limit);
      const txList = txns ?? [];
      if (txList.length === 0) {
        if (cbChatId) await tg(cbChatId, "📭 تراکنشی برای نمایش وجود ندارد.", mainMenu());
        return json({ ok: true });
      }
      const currency = txList[0]?.currency || "IRT";
      const label = currency === "IRT" ? "تومان" : "ریال";
      let msg = "📋 <b>تراکنش‌های شما</b> (" + (cbData === "txns_all" ? "همه" : String(limit)) + " مورد)\n\n";
      for (const t of txList) {
        const sign = (t.transaction_type === "RECEIVABLE_CHARGE" || t.transaction_type === "OPENING_RECEIVABLE" || t.transaction_type === "PAYABLE_CHARGE" || t.transaction_type === "OPENING_PAYABLE") ? "+" : "-";
        msg += sign + " " + fmt(t.amount) + " " + label + " | " + t.effective_at;
        if (t.description) msg += " | " + t.description;
        msg += "\n";
      }
      if (cbChatId) await tg(cbChatId, msg, mainMenu());
    }
    return json({ ok: true });
  }

  // ===== Regular messages =====
  const message = update.message;
  if (!message || !message.chat || !message.from) return json({ ok: true });
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const telegramUserId = message.from.id;
  const telegramUsername = message.from.username;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // ===== /start =====
    if (text === "/start") {
      await tg(chatId,
        "👋 سلام!\n\n" +
        "این ربات برای مشاهده مانده بدهی و طلب شماست.\n\n" +
        "📝 <b>چه کار کنید:</b>\n" +
        "۱. اگر از صاحب دفتر کد ۶ رقمی گرفته‌اید، دکمه «🔗 اتصال با کد» را بزنید و کد را بفرستید.\n" +
        "۲. بعد از اتصال، دکمه «📊 مانده من» را بزنید تا مانده خود را ببینید.\n\n" +
        "همچنین می‌توانید دستورها را تایپ کنید: <code>/balance</code>، <code>/transactions</code>، <code>/help</code>",
        mainMenu()
      );
      return json({ ok: true });
    }

    // ===== اتصال با کد =====
    const isLinkButton = text === "🔗 اتصال با کد";
    const isLinkCommand = text.startsWith("/link ");
    // تبدیل ارقام فارسی به لاتین برای بررسی
    const latinText = toLatin(text);
    const isSixDigits = /^\d{6}$/.test(latinText);

    if (isLinkButton) {
      await tg(chatId,
        "🔗 برای اتصال، کد ۶ رقمی که از صاحب دفتر گرفته‌اید را بفرستید:\n" +
        "مثال: <code>123456</code> یا <code>/link 123456</code>",
        mainMenu()
      );
      return json({ ok: true });
    }

    if (isLinkCommand || isSixDigits) {
      const rawCode = isLinkCommand ? text.replace("/link ", "").trim() : text;
      const code = toLatin(rawCode);
      if (!/^\d{6}$/.test(code)) {
        await tg(chatId, "❌ کد باید ۶ رقم باشد. مثال: <code>/link 123456</code>", mainMenu());
        return json({ ok: true });
      }
      const { data: linkCode } = await supabase
        .from("link_codes")
        .select("*")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!linkCode) {
        await tg(chatId, "❌ کد نامعتبر، منقضی یا قبلاً استفاده شده است.", mainMenu());
        return json({ ok: true });
      }
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, display_name, ledger_id")
        .eq("id", linkCode.contact_id)
        .single();
      if (!contact) {
        await tg(chatId, "❌ مخاطب مرتبط پیدا نشد.", mainMenu());
        return json({ ok: true });
      }
      await supabase.from("link_codes").update({ used: true, used_at: new Date().toISOString() }).eq("code", code);
      await supabase.from("telegram_links").insert({
        contact_id: contact.id, ledger_id: contact.ledger_id,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername ? "@" + telegramUsername : null,
        status: "linked", scope: linkCode.scope, linked_at: new Date().toISOString(),
      });
      await supabase.from("contacts").update({ linked_telegram_id: telegramUserId }).eq("id", contact.id);
      await tg(chatId,
        "✅ اتصال موفق بود!\n\n" +
        "شما به دفتر متصل شدید.\n" +
        "نام طرف حساب: " + contact.display_name + "\n" +
        "سطح دسترسی: " + scopeLabel(linkCode.scope) + "\n\n" +
        "حالا دکمه «📊 مانده من» را بزنید تا مانده خود را ببینید.",
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
        .select("contact_id, scope")
        .eq("telegram_user_id", telegramUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        await tg(chatId,
          "❌ حساب شما متصل نیست.\n" +
          "دکمه «🔗 اتصال با کد» را بزنید و کد ۶ رقمی خود را بفرستید.",
          mainMenu()
        );
        return json({ ok: true });
      }
      const { data: txns } = await supabase
        .from("transactions")
        .select("transaction_type, amount, currency, effective_at, description")
        .eq("contact_id", link.contact_id)
        .eq("status", "POSTED")
        .order("effective_at", { ascending: false });
      const { receivable, payable } = computeBalance(txns ?? []);
      const currency = (txns && txns[0]?.currency) || "IRT";
      const label = currency === "IRT" ? "تومان" : "ریال";
      let msg = "📊 <b>مانده شما</b>\n\n";
      msg += "🟢 طلب از شما (به شما بدهکار است): <b>" + fmt(receivable) + "</b> " + label + "\n";
      msg += "🔴 بدهی شما (به او بدهکارید): <b>" + fmt(payable) + "</b> " + label + "\n";
      if (isTransactions) {
        msg += "\nتعداد تراکنش مورد نظر را انتخاب کنید:";
        await tg(chatId, msg, txnCountKeyboard());
      } else {
        msg += "\nبرای مشاهده تراکنش‌ها، دکمه «📋 تراکنش‌ها» را بزنید.";
        await tg(chatId, msg, mainMenu());
      }
      return json({ ok: true });
    }

    // ===== راهنما =====
    if (text === "/help" || text === "❓ راهنما") {
      await tg(chatId,
        "📖 <b>راهنما</b>\n\n" +
        "از دکمه‌های پایین صفحه استفاده کنید:\n\n" +
        "📊 <b>مانده من</b> — مشاهده طلب و بدهی شما\n" +
        "📋 <b>تراکنش‌ها</b> — فهرست تراکنش‌ها\n" +
        "🔗 <b>اتصال با کد</b> — راهنمای اتصال با کد ۶ رقمی\n" +
        "❓ <b>راهنما</b> — این پیام\n\n" +
        "همچنین می‌توانید دستورها را تایپ کنید: <code>/start</code>، <code>/link 123456</code>، <code>/balance</code>، <code>/transactions</code>، <code>/help</code>",
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
