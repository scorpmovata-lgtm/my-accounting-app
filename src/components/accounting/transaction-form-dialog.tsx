"use client";

import { useMemo, useState } from "react";
import { Plus, Loader2, Link2, Info, CheckCircle2, Lock, History } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { JalaliDatePicker } from "./jalali-date-picker";
import {
  ALL_KINDS,
  KIND_META,
  type Currency,
  type TxnKind,
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

const NONE = "__none__";

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
        {open ? <TransactionFormBody onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransactionFormBody({ onClose }: { onClose: () => void }) {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const { toast } = useToast();

  const [kind, setKind] = useState<TxnKind>("paid_to");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [amountRaw, setAmountRaw] = useState("");
  const [currency] = useState<Currency>("IRT");
  const [effectiveAt, setEffectiveAt] = useState<string>(todayShamsiString());
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // طرف‌حساب‌های قابل استفاده: مشترکِ مجاز (گرنت/ادمین) + شخصی خودم
  const { sharedCps, privateCps } = useMemo(() => {
    const state = useAccountingStore.getState();
    const me = state.users.find((u) => u.id === currentUserId);
    const usable = counterparties.filter((c) => {
      if (c.archivedAt) return false;
      if (c.linkedUserId === currentUserId) return false;
      if (!c.isShared) return c.ownerUserId === currentUserId;
      if (me?.role === "admin") return true;
      return state.grants.some(
        (g) => g.userId === currentUserId && g.counterpartyId === c.id
      );
    });
    return {
      sharedCps: usable.filter((c) => c.isShared),
      privateCps: usable.filter((c) => !c.isShared),
    };
  }, [counterparties, currentUserId]);

  const myCategories = useMemo(
    () => categories.filter((c) => c.userId === currentUserId),
    [categories, currentUserId]
  );

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
        kind,
        counterpartyId,
        amount: amountNum,
        currency,
        effectiveAt,
        description: description.trim() || undefined,
        categoryId: categoryId === NONE ? null : categoryId,
      },
      currentUserId
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: "خطا در ثبت", description: result.error, variant: "destructive" });
      return;
    }
    const cp = counterparties.find((c) => c.id === counterpartyId);
    const kindLabel = KIND_META[kind].label;
    toast({
      title: "تراکنش ثبت شد",
      description: `«${kindLabel} ${cp?.displayName}» با مبلغ ${toPersianDigits(
        amountNum.toLocaleString("en-US")
      )} تومان در دفتر شما ثبت شد.`,
    });
    onClose();
  }

  const meta = KIND_META[kind];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          ثبت تراکنش جدید
        </DialogTitle>
        <DialogDescription>
          رکورد در دفتر مستقل خودتان ثبت می‌شود — نیازی به ثبت متقابل طرف
          مقابل نیست. اگر طرف حساب به کاربری لینک باشد، او رکورد شما را در
          بخش «وضعیت تراکنش‌های من در حساب دیگران» می‌بیند و می‌تواند کامنت
          بگذارد.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* نوع عملیات — شش گزینه */}
        <div className="space-y-2">
          <Label>نوع عملیات</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as TxnKind)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="یک نوع عملیات انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1 text-[11px]">
                  <History className="h-3 w-3" />
                  موجودی آغازین دفتر
                </SelectLabel>
                <SelectItem value="opening_claim">
                  <span className="flex flex-col items-start py-0.5">
                    <span>ثبت طلب اولیه — طرف حساب از ابتدا به من بدهکار است</span>
                  </span>
                </SelectItem>
                <SelectItem value="opening_debt">
                  <span className="flex flex-col items-start py-0.5">
                    <span>ثبت بدهی اولیه — من از ابتدا به طرف حساب بدهکارم</span>
                  </span>
                </SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-[11px]">عملیات جاری</SelectLabel>
                {(["claim", "debt", "paid_to", "received_from"] as TxnKind[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_META[k].label} — {KIND_META[k].description.split("—")[0].trim()}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2 leading-relaxed">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {meta.receivedLike
                ? "اثر بر مانده: بدهی شما به این طرف حساب زیاد (یا طلب شما کم) می‌شود."
                : "اثر بر مانده: طلب شما از این طرف حساب زیاد (یا بدهی شما کم) می‌شود."}
            </span>
          </div>
        </div>

        {/* طرف حساب */}
        <div className="space-y-2">
          <Label>طرف حساب</Label>
          <Select value={counterpartyId} onValueChange={setCounterpartyId}>
            <SelectTrigger className="h-10">
              <SelectValue
                placeholder={
                  sharedCps.length + privateCps.length === 0
                    ? "هیچ طرف حسابی در دسترس نیست"
                    : "یک طرف حساب انتخاب کنید"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-[11px]">حساب‌های مشترک (با اجازه ادمین)</SelectLabel>
                {sharedCps.map((c) => (
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
                {sharedCps.length === 0 && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    ادمین هنوز به شما دسترسی هیچ طرف‌حساب مشترکی نداده است
                  </div>
                )}
              </SelectGroup>
              {privateCps.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1 text-[11px]">
                    <Lock className="h-3 w-3" />
                    حساب‌های شخصی من (فقط دفتر خودم)
                  </SelectLabel>
                  {privateCps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {selectedCp?.linkedUserId && (
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-2 leading-relaxed">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                این طرف حساب به کاربر «{selectedCp.linkedUsername}» لینک است؛
                او این رکورد را در بخش «حساب دیگران» خود می‌بیند و می‌تواند
                روی همین ردیف کامنت بگذارد.
              </span>
            </div>
          )}
          {selectedCp && !selectedCp.isShared && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2 leading-relaxed">
              <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                طرف‌حساب شخصی شما — فقط در دفتر خودتان قابل استفاده است.
              </span>
            </div>
          )}
        </div>

        {/* دسته‌بندی */}
        <div className="space-y-2">
          <Label>دسته‌بندی (اختیاری)</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="بدون دسته" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>بدون دسته</SelectItem>
              {myCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {myCategories.length === 0 && (
            <div className="text-[11px] text-muted-foreground">
              دسته‌بندی ندارید — از منوی «تنظیمات من» می‌توانید بسازید.
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
