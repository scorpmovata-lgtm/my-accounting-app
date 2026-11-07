// موتور حسابداری چندکاربری — نسخه ۳.۰ (تطابق دوطرفه حذف شد)
// ============================================================
// ۱) محاسبه مانده خالص هر طرف حساب در دفتر یک کاربر — بر پایه شش kind.
// ۲) جمع‌بندی دسته‌بندی‌ها.
// ۳) دید دوجانبه: تراکنش‌هایی که دیگران روی «طرف‌حساب من» ثبت کرده‌اند.
//
// قرارداد علامت‌گذاری:
//   net = totalReceivedLike − totalPaidLike
//   receivedLike (دریافت از، ثبت بدهی، ثبت بدهی اولیه) → net ↑ → بدهکارم
//   paidLike    (پرداخت به، ثبت طلب، ثبت طلب اولیه)     → net ↓ → طلبکارم
//   net > 0 → بدهی من؛ net < 0 → طلب من؛ net === 0 → تسویه

import {
  Counterparty,
  Transaction,
  TxnKind,
  isReceivedLike,
} from "./types";

// ---------------------------------------------------------------------------
// مانده
// ---------------------------------------------------------------------------

export interface ContactBalance {
  counterpartyId: string;
  totalReceived: number; // جمع kinds دریافت‌مانند
  totalPaid: number; // جمع kinds پرداخت‌مانند
  net: number; // received − paid
  receivable: number; // max(−net, 0) → طلب باز من
  payable: number; // max( net, 0) → بدهی باز من
  transactionCount: number;
}

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
    if (isReceivedLike(t.kind)) totalReceived += t.amount;
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
  totalReceivable: number;
  totalPayable: number;
  totalReceived: number;
  totalPaid: number;
  netComputed: number;
}

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
    netComputed:
      byContact.reduce((s, c) => s + c.receivable, 0) -
      byContact.reduce((s, c) => s + c.payable, 0),
  };
}

// ---------------------------------------------------------------------------
// جمع‌بندی دسته‌بندی‌ها (دفتر یک کاربر)
// ---------------------------------------------------------------------------

export interface CategoryTotal {
  categoryId: string | null;
  claimTotal: number; // جمع مبالغ پرداخت‌مانند (طرف طلبکار شد)
  debtTotal: number; // جمع مبالغ دریافت‌مانند (طرف بدهکار شد)
  net: number; // claim − debt (خودِ net منفی‌شده)
  count: number;
}

export function computeCategoryTotals(
  userId: string,
  transactions: Transaction[]
): CategoryTotal[] {
  const posted = transactions.filter(
    (t) => t.userId === userId && t.status === "POSTED"
  );
  const map = new Map<string, CategoryTotal>();
  for (const t of posted) {
    const key = t.categoryId ?? "";
    const row =
      map.get(key) ??
      { categoryId: t.categoryId ?? null, claimTotal: 0, debtTotal: 0, net: 0, count: 0 };
    if (isReceivedLike(t.kind)) row.debtTotal += t.amount;
    else row.claimTotal += t.amount;
    row.count += 1;
    map.set(key, row);
  }
  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    net: r.claimTotal - r.debtTotal,
  }));
  rows.sort((a, b) => Math.abs(b.claimTotal + b.debtTotal) - Math.abs(a.claimTotal + a.debtTotal));
  return rows;
}

// ---------------------------------------------------------------------------
// دید دوجانبه: تراکنش‌های دیگران درباره من
// ---------------------------------------------------------------------------

export interface OthersAboutMe {
  transactions: Transaction[];
  byOwner: Array<{
    ownerId: string;
    transactions: Transaction[];
    /** مجموع اثر آینه‌ای: مثبت = طلب من از او؛ منفی = بدهی من به او */
    mirroredNet: number;
  }>;
}

// تراکنش‌هایی که کاربران دیگر روی طرف‌حسابِ لینک‌شده به «من» ثبت کرده‌اند
export function computeOthersAboutMe(
  meId: string,
  transactions: Transaction[],
  counterparties: Counterparty[]
): OthersAboutMe {
  const myCpIds = new Set(
    counterparties
      .filter((c) => c.linkedUserId === meId)
      .map((c) => c.id)
  );
  const rows = transactions.filter(
    (t) => t.userId !== meId && myCpIds.has(t.counterpartyId) && t.status === "POSTED"
  );
  const byOwnerMap = new Map<string, Transaction[]>();
  for (const t of rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const arr = byOwnerMap.get(t.userId) ?? [];
    arr.push(t);
    byOwnerMap.set(t.userId, arr);
  }
  const byOwner = Array.from(byOwnerMap.entries())
    .map(([ownerId, txns]) => ({
      ownerId,
      transactions: txns,
      mirroredNet: txns.reduce((s, t) => s + (isReceivedLike(t.kind) ? t.amount : -t.amount), 0),
    }))
    .sort((a, b) => Math.abs(b.mirroredNet) - Math.abs(a.mirroredNet));
  return { transactions: rows, byOwner };
}

// ---------------------------------------------------------------------------
// اعتبارسنجی ساده
// ---------------------------------------------------------------------------

export function validateTransactionInput(input: {
  kind: TxnKind;
  amount: number;
  counterpartyId: string;
}): { ok: boolean; error?: string } {
  if (!input.counterpartyId) {
    return { ok: false, error: "طرف حساب باید انتخاب شود." };
  }
  const VALID_KINDS = [
    "opening_claim",
    "opening_debt",
    "claim",
    "debt",
    "paid_to",
    "received_from",
  ];
  if (!VALID_KINDS.includes(input.kind)) {
    return { ok: false, error: "نوع عملیات نامعتبر است." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "مبلغ باید عددی مثبت باشد." };
  }
  if (input.amount !== Math.floor(input.amount)) {
    return { ok: false, error: "مبلغ باید عدد صحیح باشد." };
  }
  return { ok: true };
}
