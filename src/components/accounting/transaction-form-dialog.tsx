"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountingStore } from "@/store/accounting-store";
import { JalaliDatePicker } from "./jalali-date-picker";
import {
  Currency,
  TRANSACTION_TYPE_LABELS,
  TransactionType,
} from "@/lib/accounting/types";
import {
  formatAmount,
  fromPersianDigits,
  toPersianDigits,
  todayISO,
} from "@/lib/accounting/jalali";
import { useToast } from "@/hooks/use-toast";

// قالب‌بندی مبلغ با separator هزارگان در حین تایپ
// مثلاً: 1000000 → 1,000,000 (یا ۱,۰۰۰,۰۰۰ با ارقام فارسی)
function formatWithSeparator(input: string): string {
  // فقط ارقام را نگه‌دار
  const digits = fromPersianDigits(input).replace(/[^0-9]/g, "");
  if (!digits) return "";
  // جداکننده‌ی هزارگان اضافه کن
  const withSeparator = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // به ارقام فارسی تبدیل کن
  return toPersianDigits(withSeparator);
}

// استخراج عدد خالص از رشته‌ی فرمت‌شده
function parseAmount(input: string): number {
  const digits = fromPersianDigits(input).replace(/[^0-9]/g, "");
  return parseInt(digits || "0", 10);
}

// بررسی اینکه آیا نوع تراکنش receipt است (دریافت)
function isReceiptType(type: TransactionType): boolean {
  return type === "RECEIPT_ALLOCATION";
}
function isPaymentType(type: TransactionType): boolean {
  return type === "PAYMENT_ALLOCATION";
}

export function TransactionFormDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overpayConfirm, setOverpayConfirm] = useState(false);
  const contacts = useAccountingStore((s) => s.contacts);
  const categories = useAccountingStore((s) => s.categories);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const transactions = useAccountingStore((s) => s.transactions);
  const { toast } = useToast();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [type, setType] = useState<TransactionType>("RECEIVABLE_CHARGE");
  const [amountStr, setAmountStr] = useState(""); // با separator
  const [currency, setCurrency] = useState<Currency>("IRT");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  const selectedContact = contacts.find((c) => c.id === contactId);

  // محاسبه‌ی مانده جاری برای contact انتخاب‌شده (برای اعتبارسنجی overpayment)
  const contactBalance = useMemo(() => {
    if (!contactId) return { receivable: 0, payable: 0 };
    let receivable = 0;
    let payable = 0;
    for (const t of transactions) {
      if (t.contactId !== contactId || t.status !== "POSTED") continue;
      if (t.currency !== currency) continue;
      if (
        t.transactionType === "RECEIVABLE_CHARGE" ||
        t.transactionType === "OPENING_RECEIVABLE"
      ) {
        receivable += t.amount;
      } else if (
        t.transactionType === "PAYABLE_CHARGE" ||
        t.transactionType === "OPENING_PAYABLE"
      ) {
        payable += t.amount;
      } else if (t.transactionType === "RECEIPT_ALLOCATION") {
        receivable -= t.amount;
      } else if (t.transactionType === "PAYMENT_ALLOCATION") {
        payable -= t.amount;
      }
    }
    return { receivable, payable };
  }, [contactId, transactions, currency]);

  const amount = parseAmount(amountStr);
  const amountPreview = amount > 0 ? formatAmount(amount, currency) : null;

  // هشدار overpayment: اگر receipt > receivable یا payment > payable
  const isOverpay =
    (isReceiptType(type) && amount > contactBalance.receivable && contactBalance.receivable > 0) ||
    (isPaymentType(type) && amount > contactBalance.payable && contactBalance.payable > 0);
  const overpayAmount = isOverpay
    ? isReceiptType(type)
      ? amount - contactBalance.receivable
      : amount - contactBalance.payable
    : 0;

  function reset() {
    setContactId("");
    setCategoryId("none");
    setType("RECEIVABLE_CHARGE");
    setAmountStr("");
    setCurrency("IRT");
    setDate(todayISO());
    setDescription("");
    setOverpayConfirm(false);
  }

  function handleAmountChange(value: string) {
    // فقط ارقام فارسی/عربی/لاتین را بپذیر و separator اضافه کن
    setAmountStr(formatWithSeparator(value));
    setOverpayConfirm(false);
  }

  async function handleSubmit() {
    if (!contactId) {
      toast({
        title: "خطا",
        description: "یک طرف حساب انتخاب کنید.",
        variant: "destructive",
      });
      return;
    }
    if (!amount || amount <= 0) {
      toast({
        title: "خطا",
        description: "مبلغ معتبر وارد کنید (عدد مثبت).",
        variant: "destructive",
      });
      return;
    }

    // اگر overpayment باشد، نیاز به تأیید دارد
    if (isOverpay && !overpayConfirm) {
      setOverpayConfirm(true);
      return; // منتظر تأیید کاربر
    }

    setSubmitting(true);
    try {
      const result = await addTransaction({
        contactId,
        categoryId: categoryId === "none" ? null : categoryId,
        transactionType: type,
        amount,
        currency,
        effectiveAt: date,
        description: description.trim() || undefined,
      });

      if (result.ok) {
        toast({
          title: "تراکنش ثبت شد",
          description: `${formatAmount(amount, currency)} برای ${
            selectedContact?.displayName ?? ""
          }`,
        });
        reset();
        setOpen(false);
      } else {
        toast({
          title: "خطا در ثبت تراکنش",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "خطای غیرمنتظره",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 ml-1" />
          افزودن تراکنش
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-persian">
        <DialogHeader>
          <DialogTitle>ثبت تراکنش جدید</DialogTitle>
          <DialogDescription>
            طبق قواعد حسابداری، طلب و بدهی ناخالص جداگانه ثبت می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>نوع عملیات</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as TransactionType);
                setOverpayConfirm(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(
                    TRANSACTION_TYPE_LABELS
                  ) as [TransactionType, string][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>طرف حساب</Label>
              <Select
                value={contactId}
                onValueChange={(v) => {
                  setContactId(v);
                  setOverpayConfirm(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>سرفصل</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سرفصل</SelectItem>
                  {categories
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* نمایش مانده جاری contact برای راهنمایی کاربر */}
          {contactId && (contactBalance.receivable > 0 || contactBalance.payable > 0) && (
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <div className="font-medium text-foreground">مانده فعلی {selectedContact?.displayName}:</div>
              {contactBalance.receivable > 0 && (
                <div className="text-emerald-700 dark:text-emerald-300">
                  🟢 طلب باز: {formatAmount(contactBalance.receivable, currency)}
                </div>
              )}
              {contactBalance.payable > 0 && (
                <div className="text-rose-700 dark:text-rose-300">
                  🔴 بدهی باز: {formatAmount(contactBalance.payable, currency)}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>مبلغ</Label>
              <Input
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                inputMode="numeric"
                placeholder="مثلاً ۱٬۰۰۰٬۰۰۰"
                dir="ltr"
                className="text-right text-lg font-medium"
              />
              {amountPreview && (
                <span className="text-xs text-muted-foreground">
                  معادل: {amountPreview}
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <Label>واحد پول</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRT">تومان</SelectItem>
                  <SelectItem value="IRR">ریال</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* هشدار overpayment */}
          {isOverpay && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">
                    توجه: مبلغ از مانده باز بیشتر است
                  </div>
                  <div className="text-amber-700 dark:text-amber-400 text-xs">
                    {isReceiptType(type) ? (
                      <>
                        طلب باز فعلی: {formatAmount(contactBalance.receivable, currency)}
                        <br />
                        مبلغ دریافت: {formatAmount(amount, currency)}
                        <br />
                        <strong>مابه‌التفاوت ({formatAmount(overpayAmount, currency)}) به‌عنوان بدهی جدید به این طرف حساب ثبت خواهد شد.</strong>
                        <br />
                        یعنی شما به‌اندازه‌ی مابه‌التفاوت به {selectedContact?.displayName} بدهکار می‌شوید.
                      </>
                    ) : (
                      <>
                        بدهی باز فعلی: {formatAmount(contactBalance.payable, currency)}
                        <br />
                        مبلغ پرداخت: {formatAmount(amount, currency)}
                        <br />
                        <strong>مابه‌التفاوت ({formatAmount(overpayAmount, currency)}) به‌عنوان طلب جدید از این طرف حساب ثبت خواهد شد.</strong>
                        <br />
                        یعنی {selectedContact?.displayName} به‌اندازه‌ی مابه‌التفاوت به شما بدهکار می‌شود.
                      </>
                    )}
                  </div>
                  {!overpayConfirm ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50"
                      onClick={() => setOverpayConfirm(true)}
                    >
                      تأیید و ادامه
                    </Button>
                  ) : (
                    <div className="text-emerald-700 dark:text-emerald-400 text-xs font-medium pt-1">
                      ✓ تأیید شد. دکمه «ثبت تراکنش» را بزن.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>تاریخ مؤثر</Label>
            <JalaliDatePicker value={date} onChange={setDate} />
          </div>

          <div className="grid gap-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً: فروش کالا، قرض، اجاره..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            انصراف
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (isOverpay && !overpayConfirm)}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                در حال ثبت...
              </>
            ) : isOverpay && !overpayConfirm ? (
              "ابتدا تأیید کنید"
            ) : overpayConfirm ? (
              "ثبت با تأیید بیش‌پرداخت"
            ) : (
              "ثبت تراکنش"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
