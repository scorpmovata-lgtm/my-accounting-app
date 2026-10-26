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
import { computeContactBalance } from "@/lib/accounting/engine";
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

// قالب‌بندی عدد با جداکننده هزارگان (ارقام فارسی)
function formatWithSeparator(input: string): string {
  // ابتدا کاراکترهای غیررقمی را حذف می‌کنیم
  const digits = fromPersianDigits(input).replace(/[^0-9]/g, "");
  if (!digits) return "";
  // جدا کردن از راست به چپ در گروه‌های ۳تایی
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "،");
  return toPersianDigits(withSep);
}

// استخراج عدد از رشته قالب‌شده با جداکننده
function parseAmount(input: string): number {
  const digits = fromPersianDigits(input).replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}

interface TransactionFormDialogProps {
  // controlled mode: اگر ارائه شود، والد کنترل می‌کند (مثلاً از منوی پایین)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransactionFormDialog({
  open: controlledOpen,
  onOpenChange,
}: TransactionFormDialogProps = {}) {
  // اگر controlled نباشد، uncontrolled با state داخلی
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const contacts = useAccountingStore((s) => s.contacts);
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const realMode = useAccountingStore((s) => s.realMode);
  const { toast } = useToast();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [type, setType] = useState<TransactionType>("RECEIVABLE_CHARGE");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState<Currency>("IRT");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [overpayConfirmed, setOverpayConfirmed] = useState(false);

  // مانده فعلی مخاطب انتخاب‌شده
  const contactBalance = useMemo(() => {
    if (!contactId) return null;
    return computeContactBalance(contactId, transactions);
  }, [contactId, transactions]);

  const amountNum = parseAmount(amountStr);

  const isReceipt = type === "RECEIPT_ALLOCATION";
  const isPayment = type === "PAYMENT_ALLOCATION";

  // آیا این یک overpay است؟
  const overpayInfo = useMemo(() => {
    if (!contactBalance || amountNum <= 0) return null;
    if (isReceipt && amountNum > contactBalance.outstandingReceivable) {
      return {
        type: "receipt" as const,
        outstanding: contactBalance.outstandingReceivable,
        excess: amountNum - contactBalance.outstandingReceivable,
      };
    }
    if (isPayment && amountNum > contactBalance.outstandingPayable) {
      return {
        type: "payment" as const,
        outstanding: contactBalance.outstandingPayable,
        excess: amountNum - contactBalance.outstandingPayable,
      };
    }
    return null;
  }, [contactBalance, amountNum, isReceipt, isPayment]);

  // وقتی مقدار amount یا نوع یا مخاطب تغییر می‌کند، تأیید overpay ریست می‌شود
  function resetOverpayConfirmation() {
    setOverpayConfirmed((prev) => (prev ? false : prev));
  }

  function reset() {
    setContactId("");
    setCategoryId("none");
    setType("RECEIVABLE_CHARGE");
    setAmountStr("");
    setCurrency("IRT");
    setDate(todayISO());
    setDescription("");
    setOverpayConfirmed(false);
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
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "خطا",
        description: "مبلغ معتبر وارد کنید (عدد مثبت).",
        variant: "destructive",
      });
      return;
    }
    // اگر overpay است و تأیید نشده، جلوگیری کن
    if (overpayInfo && !overpayConfirmed) {
      toast({
        title: "تأیید لازم",
        description:
          "مبلغ از مانده باز بیشتر است. روی «تأیید و ادامه» بزنید تا ادامه دهید.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await addTransaction({
        contactId,
        categoryId: categoryId === "none" ? null : categoryId,
        transactionType: type,
        amount: amountNum,
        currency,
        effectiveAt: date,
        description: description.trim() || undefined,
        allowOverpay: !!overpayInfo,
      });
      if (result.ok) {
        const primary = result.transaction;
        const secondary = result.secondaryTransaction;
        if (secondary) {
          // حالت split در mock
          toast({
            title: "تراکنش ثبت شد (شکسته)",
            description: `دو تراکنش ثبت شد: ${formatAmount(
              primary?.amount ?? 0,
              currency
            )} + ${formatAmount(secondary.amount, currency)}`,
          });
        } else {
          toast({
            title: "تراکنش ثبت شد",
            description: `${formatAmount(amountNum, currency)} برای ${
              contacts.find((c) => c.id === contactId)?.displayName ?? ""
            }`,
          });
        }
        reset();
        setOpen(false);
      } else {
        toast({
          title: "خطا در ثبت تراکنش",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId);

  const submitDisabled =
    submitting ||
    !contactId ||
    !amountNum ||
    (!!overpayInfo && !overpayConfirmed);

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-persian">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            ثبت تراکنش جدید
          </DialogTitle>
          <DialogDescription>
            طبق قواعد حسابداری، طلب و بدهی ناخالص جداگانه ثبت می‌شوند. دریافت
            نباید از طلب باز بیشتر باشد و پرداخت نباید از بدهی باز بیشتر باشد.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {/* نوع عملیات — ردیف کامل */}
          <div className="grid gap-2">
            <Label>نوع عملیات</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as TransactionType);
                resetOverpayConfirmation();
              }}
            >
              <SelectTrigger className="h-10">
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

          {/* طرف حساب و سرفصل — دو ستونی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>طرف حساب</Label>
              <Select
                value={contactId}
                onValueChange={(v) => {
                  setContactId(v);
                  resetOverpayConfirmation();
                }}
              >
                <SelectTrigger className="h-10">
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
                <SelectTrigger className="h-10">
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

          {/* کارت مانده فعلی مخاطب */}
          {selectedContact && contactBalance && (
            <div className="rounded-md border p-3 bg-muted/30 text-sm">
              <div className="font-medium mb-1.5">
                مانده فعلی {selectedContact.displayName}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  طلب باز: {formatAmount(contactBalance.outstandingReceivable)}
                </span>
                <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  بدهی باز: {formatAmount(contactBalance.outstandingPayable)}
                </span>
              </div>
            </div>
          )}

          {/* مبلغ و واحد — دو ستونی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>مبلغ</Label>
              <Input
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(formatWithSeparator(e.target.value));
                  resetOverpayConfirmation();
                }}
                inputMode="numeric"
                placeholder="مثلاً ۵۰۰٬۰۰۰"
                dir="ltr"
                className="h-10 text-right font-medium text-lg"
              />
              {amountNum > 0 && (
                <span className="text-xs text-muted-foreground">
                  معادل: {formatAmount(amountNum, currency)}
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <Label>واحد پول</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRT">تومان</SelectItem>
                  <SelectItem value="IRR">ریال</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* هشدار overpay */}
          {overpayInfo && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {overpayInfo.type === "receipt" ? (
                    <div>
                      مبلغ دریافت ({formatAmount(amountNum, currency)}) از طلب
                      باز ({formatAmount(overpayInfo.outstanding, currency)})
                      بیشتر است.
                      {realMode ? (
                        <div className="mt-1 text-xs">
                          در حالت واقعی، Edge Function این عملیات را رد
                          می‌کند. ابتدا طلب را افزایش دهید یا مبلغ را کاهش دهید.
                        </div>
                      ) : (
                        <div className="mt-1 text-xs">
                          در حالت موک، با تأیید شما این عملیات به دو تراکنش
                          شکسته می‌شود: دریافت{" "}
                          {formatAmount(overpayInfo.outstanding, currency)} +{" "}
                          ایجاد بدهی {formatAmount(overpayInfo.excess, currency)}.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      مبلغ پرداخت ({formatAmount(amountNum, currency)}) از بدهی
                      باز ({formatAmount(overpayInfo.outstanding, currency)})
                      بیشتر است.
                      {realMode ? (
                        <div className="mt-1 text-xs">
                          در حالت واقعی، Edge Function این عملیات را رد
                          می‌کند. ابتدا بدهی را افزایش دهید یا مبلغ را کاهش دهید.
                        </div>
                      ) : (
                        <div className="mt-1 text-xs">
                          در حالت موک، با تأیید شما این عملیات به دو تراکنش
                          شکسته می‌شود: پرداخت{" "}
                          {formatAmount(overpayInfo.outstanding, currency)} +{" "}
                          ایجاد طلب {formatAmount(overpayInfo.excess, currency)}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!overpayConfirmed && !realMode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setOverpayConfirmed(true)}
                >
                  <AlertTriangle className="h-4 w-4 ml-1" />
                  تأیید و ادامه
                </Button>
              )}
              {overpayConfirmed && !realMode && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ تأیید شد. اکنون می‌توانید تراکنش را ثبت کنید.
                </div>
              )}
            </div>
          )}

          {/* تاریخ مؤثر — ردیف کامل */}
          <div className="grid gap-2">
            <Label>تاریخ مؤثر</Label>
            <JalaliDatePicker value={date} onChange={setDate} />
          </div>

          {/* توضیحات — ردیف کامل */}
          <div className="grid gap-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً: فروش کالا، قرض، اجاره..."
              rows={2}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            انصراف
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 ml-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 ml-1" />
            )}
            ثبت تراکنش
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
