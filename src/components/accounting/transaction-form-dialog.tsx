"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2, Link2, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { JalaliDatePicker } from "./jalali-date-picker";
import {
  DIRECTION_LABELS,
  type Currency,
  type TxDirection,
} from "@/lib/accounting/types";
import { computeContactBalance } from "@/lib/accounting/engine";
import {
  fromPersianDigits,
  toPersianDigits,
  todayShamsiString,
  formatShamsiLong,
} from "@/lib/accounting/jalali";

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function TransactionFormDialog({
  open: controlledOpen,
  onOpenChange,
  trigger,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        {/* بدنه فرم فقط وقتی دیالوگ باز است mount می‌شود؛
            با بسته‌شدن، unmount و state آن به‌صورت طبیعی ریست می‌شود. */}
        {open ? <TransactionFormBody onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransactionFormBody({ onClose }: { onClose: () => void }) {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const { toast } = useToast();

  const currentUser = users.find((u) => u.id === currentUserId);

  const [direction, setDirection] = useState<TxDirection>("received_from");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [currency] = useState<Currency>("IRT");
  const [effectiveAt, setEffectiveAt] = useState<string>(todayShamsiString());
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableCounterparties = useMemo(() => {
    return counterparties.filter((c) => {
      if (c.linkedUserId === currentUserId) return false;
      return !c.archivedAt;
    });
  }, [counterparties, currentUserId]);

  const selectedCp = counterparties.find((c) => c.id === counterpartyId);
  const selectedBalance =
    currentUserId && counterpartyId
      ? computeContactBalance(currentUserId, counterpartyId, transactions)
      : null;

  const amountNum = parseInt(
    fromPersianDigits(amountRaw).replace(/[^\d]/g, ""),
    10
  );

  function handleAmountChange(v: string) {
    const cleaned = fromPersianDigits(v).replace(/[^\d]/g, "");
    if (cleaned === "") {
      setAmountRaw("");
      return;
    }
    setAmountRaw(toPersianDigits(parseInt(cleaned, 10).toLocaleString("en-US")));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    if (!counterpartyId) {
      toast({ title: "خطا", description: "طرف حساب را انتخاب کنید.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "خطا", description: "مبلغ نامعتبر است.", variant: "destructive" });
      return;
    }
    if (!effectiveAt) {
      toast({ title: "خطا", description: "تاریخ را انتخاب کنید.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    const result = await addTransaction(
      {
        direction,
        counterpartyId,
        amount: amountNum,
        currency,
        effectiveAt,
        description: description.trim() || undefined,
      },
      currentUserId
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: "خطا در ثبت", description: result.error, variant: "destructive" });
      return;
    }
    const cp = counterparties.find((c) => c.id === counterpartyId);
    const dirLabel = DIRECTION_LABELS[direction];
    if (result.matchedWith) {
      toast({
        title: "تراکنش ثبت و تطبیق شد ✓",
        description: `«${dirLabel} ${cp?.displayName}» با سمت طرف مقابل تطبیق داده شد.`,
      });
    } else if (cp?.linkedUserId) {
      toast({
        title: "تراکنش ثبت شد (در انتظار)",
        description: `«${dirLabel} ${cp?.displayName}» ثبت شد. در انتظار ثبت توسط طرف مقابل (${cp.linkedUsername}).`,
      });
    } else {
      toast({
        title: "تراکنش ثبت شد",
        description: `«${dirLabel} ${cp?.displayName}» ثبت شد.`,
      });
    }
    onClose();
  }

  if (!currentUser) return null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          ثبت تراکنش جدید
        </DialogTitle>
        <DialogDescription>
          یک رکورد در دفتر خود ثبت کنید. اگر طرف حساب به کاربری لینک باشد و او
          هم این رویداد را ثبت کند، سامانه خودکار آن دو را تطبیق می‌دهد.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* جهت عملیات */}
        <div className="space-y-2">
          <Label>نوع عملیات</Label>
          <ToggleGroup
            type="single"
            value={direction}
            onValueChange={(v) => v && setDirection(v as TxDirection)}
            className="grid grid-cols-2 gap-2 w-full"
          >
            <ToggleGroupItem
              value="received_from"
              className="data-[state=on]:bg-emerald-600 data-[state=on]:text-white h-11"
              aria-label="دریافت از"
            >
              {DIRECTION_LABELS.received_from}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="paid_to"
              className="data-[state=on]:bg-rose-600 data-[state=on]:text-white h-11"
              aria-label="پرداخت به"
            >
              {DIRECTION_LABELS.paid_to}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* طرف حساب */}
        <div className="space-y-2">
          <Label>طرف حساب</Label>
          <Select value={counterpartyId} onValueChange={setCounterpartyId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="یک طرف حساب انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {availableCounterparties.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.displayName}
                    {c.linkedUserId && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px] gap-0.5 border-emerald-300 text-emerald-700"
                      >
                        <Link2 className="h-2 w-2" />
                        {c.linkedUsername}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCp?.linkedUserId && (
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                این طرف حساب به کاربر «{selectedCp.linkedUsername}» لینک است.
                اگر آن کاربر هم این رویداد را در دفتر خود ثبت کند، سامانه خودکار
                تطبیق می‌دهد.
              </span>
            </div>
          )}
        </div>

        {/* مبلغ و واحد */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="amount">مبلغ (تومان)</Label>
            <Input
              id="amount"
              dir="ltr"
              className="h-10 text-right font-medium text-lg"
              placeholder="۰"
              value={amountRaw}
              onChange={(e) => handleAmountChange(e.target.value)}
              inputMode="numeric"
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>واحد</Label>
            <div className="h-10 flex items-center justify-center rounded-md border bg-muted/30 text-sm font-medium">
              تومان
            </div>
          </div>
        </div>

        {/* تاریخ مؤثر */}
        <div className="space-y-2">
          <Label>تاریخ مؤثر (شمسی)</Label>
          <JalaliDatePicker
            value={effectiveAt}
            onChange={setEffectiveAt}
            placeholder="انتخاب تاریخ"
          />
          {effectiveAt && (
            <div className="text-[11px] text-muted-foreground">
              تاریخ انتخابی: {formatShamsiLong(effectiveAt)}
            </div>
          )}
        </div>

        {/* مانده فعلی با این طرف حساب */}
        {selectedBalance && selectedBalance.transactionCount > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                مانده فعلی با {selectedCp?.displayName}:
              </span>
              {selectedBalance.net > 0 ? (
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  بدهی {toPersianDigits(Math.abs(selectedBalance.net).toLocaleString("en-US"))} ت
                </Badge>
              ) : selectedBalance.net < 0 ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  طلب {toPersianDigits(Math.abs(selectedBalance.net).toLocaleString("en-US"))} ت
                </Badge>
              ) : (
                <Badge variant="secondary">تسویه</Badge>
              )}
            </div>
          </div>
        )}

        {/* توضیحات */}
        <div className="space-y-2">
          <Label htmlFor="description">توضیحات (اختیاری)</Label>
          <Textarea
            id="description"
            rows={2}
            placeholder="مثلاً: پرداخت قسط وام"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
            disabled={submitting}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting || !counterpartyId || !amountRaw}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 ml-2" />
            )}
            ثبت تراکنش
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
