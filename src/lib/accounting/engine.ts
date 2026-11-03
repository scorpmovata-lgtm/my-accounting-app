// موتور حسابداری چندکاربری — نسخه ۲.۰
// ============================================================
// ۱) محاسبه مانده خالص برای هر طرف حساب در دفتر یک کاربر.
// ۲) منطق تطابق بین‌کاربری: آیا دو تراکنش (در دو دفتر متفاوت) یک رویداد
//    واقعی را توصیف می‌کنند؟
//
// قرارداد علامت‌گذاری:
//   net = totalReceived − totalPaid
//   net  > 0  →  بدهی   (من بدهکارم)
//   net  < 0  →  طلب    (طرف حساب بدهکار است)
//   net === 0 →  تسویه

import {
  Counterparty,
  MatchStatus,
  Transaction,
  TxDirection,
} from "./types";

// ---------------------------------------------------------------------------
// مانده
// ---------------------------------------------------------------------------

export interface ContactBalance {
  counterpartyId: string;
  totalReceived: number; // جمع «دریافت از»
  totalPaid: number; // جمع «پرداخت به»
  net: number; // received − paid
  // نمایش‌محور:
  receivable: number; // max(−net, 0)  → طلب باز
  payable: number; // max( net, 0)  → بدهی باز
  transactionCount: number;
}

// مانده یک طرف حساب مشخص در دفتر یک کاربر
export function computeContactBalance(
  userId: string,
  counterpartyId: string,
  transactions: Transaction[]
): ContactBalance {
  const relevant = transactions.filter(
    (t) =>
      t.userId === userId &&
      t.counterpartyId === counterpartyId &&
      t.status === "POSTED"
  );
  let totalReceived = 0;
  let totalPaid = 0;
  for (const t of relevant) {
    if (t.direction === "received_from") totalReceived += t.amount;
    else totalPaid += t.amount;
  }
  const net = totalReceived - totalPaid;
  return {
    counterpartyId,
    totalReceived,
    totalPaid,
    net,
    receivable: Math.max(-net, 0),
    payable: Math.max(net, 0),
    transactionCount: relevant.length,
  };
}

export interface LedgerBalance {
  byContact: ContactBalance[];
  totalReceivable: number; // جمع طلب‌ها
  totalPayable: number; // جمع بدهی‌ها
  totalReceived: number;
  totalPaid: number;
  netComputed: number;
}

// مانده کل دفتر یک کاربر (فقط طرف حساب‌هایی که حداقل یک تراکنش دارند)
export function computeLedgerBalance(
  userId: string,
  transactions: Transaction[],
  _counterparties: Counterparty[]
): LedgerBalance {
  const posted = transactions.filter(
    (t) => t.userId === userId && t.status === "POSTED"
  );
  const cpIds = Array.from(new Set(posted.map((t) => t.counterpartyId)));
  const byContact = cpIds.map((id) =>
    computeContactBalance(userId, id, transactions)
  );
  return {
    byContact,
    totalReceivable: byContact.reduce((s, c) => s + c.receivable, 0),
    totalPayable: byContact.reduce((s, c) => s + c.payable, 0),
    totalReceived: byContact.reduce((s, c) => s + c.totalReceived, 0),
    totalPaid: byContact.reduce((s, c) => s + c.totalPaid, 0),
    // خالص به‌صورت طلب منهای بدهی تعریف می‌شود:
    //   netComputed > 0 → طلب خالص (بیشتر طلب‌کارید)
    //   netComputed < 0 → بدهی خالص (بیشتر بدهکارید)
    netComputed:
      byContact.reduce((s, c) => s + c.receivable, 0) -
      byContact.reduce((s, c) => s + c.payable, 0),
  };
}

// ---------------------------------------------------------------------------
// تطابق بین‌کاربری
// ---------------------------------------------------------------------------

// آیا دو تراکنش (در دو دفتر متفاوت) یک رویداد واقعی را توصیف می‌کنند؟
//
// شرایط:
//   - هر دو POSTED
//   - userId متفاوت
//   - مبلغ و واحد برابر
//   - تاریخ مؤثر برابر
//   - جهت‌ها متضاد (یکی received_from، دیگری paid_to) — یعنی یک نفر داده،
//     دیگری گرفته
//   - طرف حسابِ تراکنش ۱ به کاربرِ تراکنش ۲ لینک باشد (cp1.linkedUserId === t2.userId)
//   - طرف حسابِ تراکنش ۲ به کاربرِ تراکنش ۱ لینک باشد (cp2.linkedUserId === t1.userId)
//
// نمونه:
//   t1 (در دفتر A = وحید): direction=paid_to,    counterparty=فائزه (linked→user B)
//   t2 (در دفتر B = فائزه): direction=received_from, counterparty=وحید (linked→user A)
//   → MATCH (رویداد: وحید به فائزه ۱M پرداخت کرد)
export function isMatchingPair(
  t1: Transaction,
  t2: Transaction,
  counterparties: Counterparty[]
): boolean {
  if (t1.status !== "POSTED" || t2.status !== "POSTED") return false;
  if (t1.userId === t2.userId) return false; // باید دو دفتر متفاوت
  if (t1.amount !== t2.amount) return false;
  if (t1.currency !== t2.currency) return false;
  if (t1.effectiveAt !== t2.effectiveAt) return false;
  if (t1.direction === t2.direction) return false; // باید متضاد

  const cp1 = counterparties.find((c) => c.id === t1.counterpartyId);
  const cp2 = counterparties.find((c) => c.id === t2.counterpartyId);
  if (!cp1 || !cp2) return false;
  if (cp1.linkedUserId !== t2.userId) return false;
  if (cp2.linkedUserId !== t1.userId) return false;
  return true;
}

// یافتن تراکنش تطبیق‌یافته برای t در میان همه تراکنش‌ها
export function findMatch(
  t: Transaction,
  allTransactions: Transaction[],
  counterparties: Counterparty[]
): Transaction | null {
  const cp = counterparties.find((c) => c.id === t.counterpartyId);
  // طرف حساب به کاربری لینک نیست → تطابق معنا ندارد
  if (!cp || !cp.linkedUserId) return null;

  for (const other of allTransactions) {
    if (other.id === t.id) continue;
    if (other.userId !== cp.linkedUserId) continue;
    if (isMatchingPair(t, other, counterparties)) {
      return other;
    }
  }
  return null;
}

// محاسبه وضعیت تطابق یک تراکنش
export function computeMatchStatus(
  t: Transaction,
  allTransactions: Transaction[],
  counterparties: Counterparty[]
): { status: MatchStatus; matchedId: string | null } {
  if (t.status !== "POSTED") {
    return { status: "unmatched", matchedId: null };
  }
  const cp = counterparties.find((c) => c.id === t.counterpartyId);
  if (!cp || !cp.linkedUserId) {
    return { status: "unmatched", matchedId: null };
  }
  const match = findMatch(t, allTransactions, counterparties);
  if (match) {
    return { status: "matched", matchedId: match.id };
  }
  return { status: "pending", matchedId: null };
}

// ---------------------------------------------------------------------------
// اعتبارسنجی ساده
// ---------------------------------------------------------------------------

export function validateTransactionInput(input: {
  direction: TxDirection;
  amount: number;
  counterpartyId: string;
}): { ok: boolean; error?: string } {
  if (!input.counterpartyId) {
    return { ok: false, error: "طرف حساب باید انتخاب شود." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "مبلغ باید عددی مثبت باشد." };
  }
  if (input.amount !== Math.floor(input.amount)) {
    return { ok: false, error: "مبلغ باید عدد صحیح باشد." };
  }
  return { ok: true };
}
