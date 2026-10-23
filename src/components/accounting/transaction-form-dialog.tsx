"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
  todayISO,
} from "@/lib/accounting/jalali";
import { useToast } from "@/hooks/use-toast";

export function TransactionFormDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const contacts = useAccountingStore((s) => s.contacts);
  const categories = useAccountingStore((s) => s.categories);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const { toast } = useToast();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [type, setType] = useState<TransactionType>("RECEIVABLE_CHARGE");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState<Currency>("IRT");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  const selectedContact = contacts.find((c) => c.id === contactId);

  function reset() {
    setContactId("");
    setCategoryId("none");
    setType("RECEIVABLE_CHARGE");
    setAmountStr("");
    setCurrency("IRT");
    setDate(todayISO());
    setDescription("");
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
    const amountLatin = fromPersianDigits(amountStr).replace(/[^0-9]/g, "");
    const amount = parseInt(amountLatin, 10);
    if (!amount || amount <= 0) {
      toast({
        title: "خطا",
        description: "مبلغ معتبر وارد کنید (عدد مثبت).",
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

  const amountPreview = (() => {
    if (!amountStr) return null;
    const n = parseInt(
      fromPersianDigits(amountStr).replace(/[^0-9]/g, ""),
      10
    );
    return n > 0 ? formatAmount(n, currency) : null;
  })();

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
            طبق قواعد حسابداری، طلب و بدهی ناخالص جداگانه ثبت می‌شوند. دریافت
            نباید از طلب باز بیشتر باشد و پرداخت نباید از بدهی باز بیشتر باشد.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* نوع تراکنش */}
          <div className="grid gap-2">
            <Label>نوع عملیات</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as TransactionType)}
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

          {/* طرف حساب و سرفصل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>طرف حساب</Label>
              <Select value={contactId} onValueChange={setContactId}>
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

          {/* مبلغ و واحد */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>مبلغ</Label>
              <Input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="numeric"
                placeholder="مثلاً ۵۰۰۰۰۰ یا 500000"
                dir="ltr"
                className="text-right"
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

          {/* تاریخ */}
          <div className="grid gap-2">
            <Label>تاریخ مؤثر</Label>
            <JalaliDatePicker value={date} onChange={setDate} />
          </div>

          {/* توضیح */}
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              "ثبت تراکنش"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
