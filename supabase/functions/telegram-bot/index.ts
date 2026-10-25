// ============================================================
// Edge Function: telegram-bot
// مسیر فایل: supabase/functions/telegram-bot/index.ts
// دیپلوی: supabase functions deploy telegram-bot --no-verify-jwt
// تنظیم webhook:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.supabase.co/functions/v1/telegram-bot"
// ============================================================

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

async function tg(chatId: number, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(TELEGRAM_API + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

function faDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d, 10)]);
}

function computeBalance(txns: Array<{ transaction_type: string; amount: number }>) {
  let receivable = 0;
  let payable = 0;
  for (const t of txns) {
    if (t.transaction_type === "RECEIVABLE_CHARGE" || t.transaction_type === "OPENING_RECEIVABLE") {
      receivable += t.amount;
    } else if (t.transaction_type === "PAYABLE_CHARGE" || t.transaction_type === "OPENING_PAYABLE") {
      payable += t.amount;
    } else if (t.transaction_type === "RECEIPT_ALLOCATION") {
      receivable -= t.amount;
    } else if (t.transaction_type === "PAYMENT_ALLOCATION") {
      payable -= t.amount;
    }
  }
  return { receivable, payable };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let update: {
    message?: {
      chat?: { id: number };
      text?: string;
      from?: { id: number; username?: string };
    };
    callback_query?: {
      id: string;
      data?: string;
      from?: { id: number };
      message?: { chat?: { id: number }; text?: string };
    };
  };
  try {
    update = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // مدیریت callback_query از inline keyboard
  if (update.callback_query) {
    const callbackId = update.callback_query.id;
    const data = update.callback_query.data;
    const cbChatId = update.callback_query.message?.chat?.id;
    const cbTelegramUserId = update.callback_query.from?.id;

    // پاسخ به callback برای برداشتن loading دکمه
    await fetch(TELEGRAM_API + "/answerCallbackQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId }),
    });

    if (!cbChatId || !cbTelegramUserId) return json({ ok: true });

    const cbSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    try {
      if (data === "back") {
        await tg(
          cbChatId,
          "📋 <b>منوی اصلی</b>\n\n" +
            "برای مشاهده مانده: <code>/balance</code>\n" +
            "برای مشاهده تراکنش‌ها: <code>/transactions</code>\n" +
            "برای راهنما: <code>/help</code>"
        );
        return json({ ok: true });
      }

      if (data && data.startsWith("txns_")) {
        const { data: link } = await cbSupabase
          .from("telegram_links")
          .select("contact_id, scope")
          .eq("telegram_user_id", cbTelegramUserId)
          .eq("status", "linked")
          .maybeSingle();
        if (!link) {
          await tg(cbChatId, "❌ حساب شما متصل نیست. با <code>/link 123456</code> اتصال دهید.");
          return json({ ok: true });
        }
        if (link.scope !== "transaction_list" && link.scope !== "transaction_details") {
          await tg(cbChatId, "⚠️ سطح دسترسی شما اجازه مشاهده تراکنش‌ها را نمی‌دهد.");
          return json({ ok: true });
        }
        const limit = data === "txns_all" ? 999 : parseInt(data.split("_")[1] ?? "10", 10);
        const { data: txns } = await cbSupabase
          .from("transactions")
          .select("transaction_type, amount, currency, effective_at, description")
          .eq("contact_id", link.contact_id)
          .eq("status", "POSTED")
          .order("effective_at", { ascending: false })
          .limit(limit);
        const txList = txns ?? [];
        if (txList.length === 0) {
          await tg(cbChatId, "📭 تراکنشی برای نمایش وجود ندارد.");
          return json({ ok: true });
        }
        const currency = txList[0]?.currency || "IRT";
        const label = currency === "IRT" ? "تومان" : "ریال";
        const countLabel = data === "txns_all" ? "همه" : faDigits(limit + "") + " مورد";
        let msg = "📋 <b>تراکنش‌ها</b> (" + countLabel + ")\n\n";
        for (const t of txList) {
          msg += "• " + t.effective_at + " | " + t.transaction_type + " | " + fmt(t.amount) + " " + label;
          if (t.description) msg += " | " + t.description;
          msg += "\n";
        }
        const backKeyboard = {
          inline_keyboard: [
            [{ text: "↩ بازگشت", callback_data: "back" }]
          ]
        };
        await tg(cbChatId, msg, backKeyboard);
        return json({ ok: true });
      }

      return json({ ok: true });
    } catch (e) {
      console.error("Callback error:", e);
      await tg(cbChatId, "⚠️ خطای سرور. بعداً تلاش کنید.");
      return json({ ok: true });
    }
  }

  const message = update.message;
  if (!message || !message.chat || !message.from) return json({ ok: true });
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const telegramUserId = message.from.id;
  const telegramUsername = message.from.username;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    if (text === "/start") {
      await tg(
        chatId,
        "👋 سلام!\n\n" +
          "این ربات برای مشاهده مانده بدهی و طلب شماست.\n" +
          "برای اتصال، کد ۶ رقمی که از صاحب دفتر گرفته‌اید را بفرستید:\n" +
          "<code>/link 123456</code>\n\n" +
          "بعد از اتصال: <code>/balance</code> برای مشاهده مانده."
      );
      return json({ ok: true });
    }

    if (text.startsWith("/link ")) {
      const code = text.replace("/link ", "").trim();
      if (!/^\d{6}$/.test(code)) {
        await tg(chatId, "❌ کد باید ۶ رقم باشد. مثال: <code>/link 123456</code>");
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
        await tg(chatId, "❌ کد نامعتبر، منقضی یا قبلاً استفاده شده است.");
        return json({ ok: true });
      }
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, display_name, ledger_id")
        .eq("id", linkCode.contact_id)
        .single();
      if (!contact) {
        await tg(chatId, "❌ مخاطب مرتبط پیدا نشد.");
        return json({ ok: true });
      }
      // علامت‌گذاری کد به‌عنوان استفاده‌شده
      await supabase
        .from("link_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("code", code);
      // درج رابطه تلگرام
      await supabase.from("telegram_links").insert({
        contact_id: contact.id,
        ledger_id: contact.ledger_id,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername ? "@" + telegramUsername : null,
        status: "linked",
        scope: linkCode.scope,
        linked_at: new Date().toISOString(),
      });
      // به‌روزرسانی مخاطب
      await supabase
        .from("contacts")
        .update({ linked_telegram_id: telegramUserId })
        .eq("id", contact.id);
      await tg(
        chatId,
        "✅ اتصال موفق بود!\n\n" +
          "شما به دفتر متصل شدید.\n" +
          "نام طرف حساب: " + contact.display_name + "\n" +
          "سطح دسترسی: " + scopeLabel(linkCode.scope) + "\n\n" +
          "حالا با <code>/balance</code> مانده خود را ببینید."
      );
      return json({ ok: true });
    }

    if (text === "/balance") {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("contact_id, scope")
        .eq("telegram_user_id", telegramUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        await tg(chatId, "❌ حساب شما متصل نیست. با <code>/link 123456</code> اتصال دهید.");
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
      msg += "\nبرای مشاهده تراکنش‌ها: <code>/transactions</code>";
      await tg(chatId, msg);
      return json({ ok: true });
    }

    if (text === "/transactions" || text === "📋 تراکنش‌ها") {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("contact_id, scope")
        .eq("telegram_user_id", telegramUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        await tg(chatId, "❌ حساب شما متصل نیست. با <code>/link 123456</code> اتصال دهید.");
        return json({ ok: true });
      }
      if (link.scope !== "transaction_list" && link.scope !== "transaction_details") {
        await tg(
          chatId,
          "⚠️ سطح دسترسی شما اجازه مشاهده تراکنش‌ها را نمی‌دهد.\n\n" +
            "برای مشاهده مانده: <code>/balance</code>"
        );
        return json({ ok: true });
      }
      // نمایش inline keyboard برای انتخاب تعداد تراکنش‌ها
      const keyboard = {
        inline_keyboard: [
          [{ text: "۱۰ تراکنش اخیر", callback_data: "txns_10" }],
          [{ text: "۳۰ تراکنش اخیر", callback_data: "txns_30" }],
          [{ text: "همه تراکنش‌ها", callback_data: "txns_all" }],
          [{ text: "↩ بازگشت", callback_data: "back" }]
        ]
      };
      await tg(
        chatId,
        "📋 <b>تراکنش‌ها</b>\n\n" +
          "تعداد تراکنش‌هایی که می‌خواهید مشاهده کنید را انتخاب کنید:",
        keyboard
      );
      return json({ ok: true });
    }

    if (text === "/help") {
      await tg(
        chatId,
        "📖 <b>دستورها</b>\n\n" +
          "• <code>/start</code> — شروع\n" +
          "• <code>/link 123456</code> — اتصال با کد\n" +
          "• <code>/balance</code> — مشاهده مانده\n" +
          "• <code>/transactions</code> — انتخاب تعداد تراکنش‌ها برای مشاهده\n" +
          "• <code>/help</code> — این پیام"
      );
      return json({ ok: true });
    }

    await tg(
      chatId,
      "❓ دستور نامشخص. <code>/help</code> را بزن."
    );
    return json({ ok: true });
  } catch (e) {
    console.error("Bot error:", e);
    await tg(chatId, "⚠️ خطای سرور. بعداً تلاش کنید.");
    return json({ ok: true });
  }
});
