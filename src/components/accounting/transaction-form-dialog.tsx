"use client";

// فرم ثبت/ویرایش تراکنش — بازطراحی Premium
// ---------------------------------------------------------------
// موبایل: Bottom Sheet (vaul) با فوتر چسبان — دکمه «ثبت تراکنش»
//   همیشه در دید است (رفع باگ ناپدیدشدن دکمه در موبایل).
// دسکتاپ: مودال مرکزی با فوتر ثابت.
// انتخاب نوع عملیات: کارت‌های بصری دوستونی به‌جای دراپ‌داون متنی.
// منطق اعتبارسنجی و ثبت بدون تغییر حفظ شده است.
// v3.5: پشتیبانی از حالت ویرایش با editTransaction prop.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Loader2,
  Link2,
  Info,
  CheckCircle2,
  Lock,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  HandCoins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { JalaliDatePicker } from "./jalali-date-picker";
import {
  KIND_META,
  type Currency,
  type Transaction,
  type TxnKind,
} from "@/lib/accounting/types";
import { computeContactBalance } from "@/lib/accounting/engine";
import {
  fromPersianDigits,
  toPersianDigits,
  todayShamsiString,
  formatShamsiLong,
} from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  /** اگر پر شود، فرم در حالت ویرایش این تراکنش باز می‌شود */
  editTransaction?: Transaction | null;
}

const NONE = "__none__";

// ---------------------------------------------------------------------------
// کارت‌های انتخاب نوع عملیات
// ---------------------------------------------------------------------------

type Tone = "emerald" | "rose" | "amber";

const TONE_CHIP: Record<Tone, string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
};

const CURRENT_KINDS: {
  kind: TxnKind;
  icon: LucideIcon;
  tone: Tone;
  short: string;
}[] = [
  {
    kind: "claim",
    icon: ArrowDownLeft,
    tone: "emerald",
    short: "طرف حساب به من بدهکار شد",
  },
  {
    kind: "paid_to",
    icon: Banknote,
    tone: "emerald",
    short: "پول پرداخت کردم",
  },
  {
    kind: "debt",
    icon: ArrowUpRight,
    tone: "rose",
    short: "من بدهکار شدم",
  },
  {
    kind: "received_from",
    icon: HandCoins,
    tone: "rose",
    short: "پول دریافت کردم",
  },
];

const OPENING_KINDS: { kind: TxnKind; label: string }[] = [
  { kind: "opening_claim", label: "طلب اولیه" },
  { kind: "opening_debt", label: "بدهی اولیه" },
];

function KindCard({
  selected,
  onClick,
  icon: Icon,
  tone,
  title,
  subtitle,
  compact = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all duration-200",
        compact && "flex-row py-2 ps-3 pe-2 text-start",
        selected
          ? "border-primary bg-accent/60 ring-2 ring-primary/25"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
          compact ? "h-7 w-7" : "h-8 w-8",
          TONE_CHIP[tone]
        )}
        aria-hidden
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-semibold leading-5",
            compact ? "text-[11px]" : "text-xs",
            selected ? "text-accent-foreground" : "text-foreground"
          )}
        >
          {title}
        </span>
        {subtitle && !compact && (
          <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// دیالوگ / دراور بسته به اندازه صفحه
// ---------------------------------------------------------------------------

export function TransactionFormDialog({
  open: controlledOpen,
  onOpenChange,
  trigger,
  editTransaction = null,
}: Props) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const isEdit = !!editTransaction;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent
          className="flex flex-col gap-0 rounded-t-2xl p-0"
          style={{ maxHeight: "94dvh", marginTop: 0 }}
        >
          {open ? (
            <TransactionFormBody
              onClose={() => setOpen(false)}
              editTransaction={editTransaction}
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open ? (
          <TransactionFormBody
            onClose={() => setOpen(false)}
            editTransaction={editTransaction}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// بدنه فرم — مشترک بین موبایل و دسکتاپ
// ---------------------------------------------------------------------------

const QUICK_AMOUNTS: { value: number; label: string }[] = [
  { value: 50_000, label: "۵۰ هزار" },
  { value: 100_000, label: "۱۰۰ هزار" },
  { value: 500_000, label: "۵۰۰ هزار" },
  { value: 1_000_000, label: "۱ میلیون" },
];

function TransactionFormBody({
  onClose,
  editTransaction = null,
}: {
  onClose: () => void;
  editTransaction?: Transaction | null;
}) {
  const isEdit = !!editTransaction;
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const addTransaction = useAccountingStore((s) => s.addTransaction);
  const updateTransaction = useAccountingStore((s) => s.updateTransaction);
  const { toast } = useToast();

  // مقداردهی اولیه: در حالت ویرایش از تراکنش موجود، در حالت ثبت از پیش‌فرض
  const [kind, setKind] = useState<TxnKind>(editTransaction?.kind ?? "paid_to");
  const [counterpartyId, setCounterpartyId] = useState(
    editTransaction?.counterpartyId ?? ""
  );
  const [categoryId, setCategoryId] = useState<string>(
    editTransaction?.categoryId ?? NONE
  );
  const [amountRaw, setAmountRaw] = useState(
    editTransaction
      ? toPersianDigits(editTransaction.amount.toLocaleString("en-US"))
      : ""
  );
  const [currency] = useState<Currency>(editTransaction?.currency ?? "IRT");
  const [effectiveAt, setEffectiveAt] = useState<string>(
    editTransaction?.effectiveAt ?? todayShamsiString()
  );
  const [description, setDescription] = useState(
    editTransaction?.description ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  // خطای درون‌خطی نزدیک فیلد + فوکوس اولین فیلد نامعتبر
  const [fieldErrors, setFieldErrors] = useState<{ cp?: string; amount?: string }>({});
  const cpTriggerRef = useRef<HTMLButtonElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

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

  // دسته‌های قابل انتخاب برای طرف‌حسابِ فعلی:
  //   - عمومی (counterpartyId === null): همه طرف‌حساب‌ها
  //   - مخصوص این طرف‌حساب (counterpartyId === counterpartyId)
  const availableCategories = useMemo(() => {
    if (!counterpartyId) return [];
    return myCategories.filter(
      (c) => !c.counterpartyId || c.counterpartyId === counterpartyId
    );
  }, [myCategories, counterpartyId]);

  // وقتی طرف‌حساب تغییر می‌کند، اگر دسته‌ی انتخاب‌شده مخصوص طرف‌حساب قدیمی
  // بوده (یا طرف‌حساب خالی شده)، انتخاب دسته را پاک می‌کنیم.
  useEffect(() => {
    if (!categoryId || categoryId === NONE) return;
    const cat = myCategories.find((c) => c.id === categoryId);
    if (!cat) return;
    if (cat.counterpartyId && cat.counterpartyId !== counterpartyId) {
      setCategoryId(NONE);
    }
  }, [counterpartyId, categoryId, myCategories]);

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
      setFieldErrors((f) => (f.amount ? { ...f, amount: undefined } : f));
      return;
    }
    setAmountRaw(toPersianDigits(parseInt(cleaned, 10).toLocaleString("en-US")));
    setFieldErrors((f) => (f.amount ? { ...f, amount: undefined } : f));
  }

  function addQuickAmount(v: number) {
    const base = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0;
    const next = base + v;
    setAmountRaw(toPersianDigits(next.toLocaleString("en-US")));
    setFieldErrors((f) => (f.amount ? { ...f, amount: undefined } : f));
  }

  function handleCounterpartyChange(id: string) {
    setCounterpartyId(id);
    setFieldErrors((f) => (f.cp ? { ...f, cp: undefined } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    const errs: { cp?: string; amount?: string } = {};
    if (!counterpartyId)
      errs.cp = "انتخاب طرف حساب الزامی است — از فهرست بالا یکی را برگزینید.";
    if (!Number.isFinite(amountNum) || amountNum <= 0)
      errs.amount = "مبلغ را با ارقام وارد کنید — باید بزرگ‌تر از صفر باشد.";
    setFieldErrors(errs);
    if (errs.cp || errs.amount) {
      if (errs.cp) cpTriggerRef.current?.focus();
      else if (errs.amount) amountInputRef.current?.focus();
      return;
    }
    if (!effectiveAt) {
      toast({ title: "خطا", description: "تاریخ را انتخاب کنید.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));

    if (isEdit && editTransaction) {
      // ---- حالت ویرایش ----
      const result = await updateTransaction(
        editTransaction.id,
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
        toast({ title: "خطا در ویرایش", description: result.error, variant: "destructive" });
        return;
      }
      const cp = counterparties.find((c) => c.id === counterpartyId);
      const kindLabel = KIND_META[kind].label;
      toast({
        title: "تراکنش به‌روزرسانی شد",
        description: `«${kindLabel} ${cp?.displayName}» با مبلغ ${toPersianDigits(
          amountNum.toLocaleString("en-US")
        )} تومان به‌روزرسانی شد.`,
      });
      onClose();
      return;
    }

    // ---- حالت ثبت جدید ----
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
  const isCurrentKind = !meta.opening;

  return (
    <>
      {/* ┌ هدر ثابت ┐ */}
      <DrawerHeader
        className="shrink-0 items-start gap-1.5 border-b brand-tint-gradient p-4 pb-3 text-right"
      >
        <DrawerTitle className="flex items-center gap-2 text-base sm:text-lg">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isEdit ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </span>
          {isEdit ? "ویرایش تراکنش" : "ثبت تراکنش جدید"}
        </DrawerTitle>
        <DrawerDescription className="text-[11px] leading-5 sm:text-xs sm:leading-6">
          {isEdit
            ? "فیلدهای تراکنش را اصلاح کنید و ذخیره کنید. این رکورد متعلق به دفتر خود شماست."
            : "رکورد در دفتر مستقل خودتان ثبت می‌شود — طرف حسابِ لینک‌شده آن را در بخش «وضعیت تراکنش‌های من در حساب دیگران» می‌بیند و می‌تواند کامنت بگذارد."}
        </DrawerDescription>
      </DrawerHeader>

      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* ┌ بدنه اسکرول‌شو ┐ */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 scrollbar-persian">
          {/* نوع عملیات — انتخابگر بصری */}
          <div className="space-y-2">
            <Label>نوع عملیات</Label>

            {/* عملیات جاری — ۴ کارت */}
            <div className="grid grid-cols-2 gap-2">
              {CURRENT_KINDS.map((k) => (
                <KindCard
                  key={k.kind}
                  selected={kind === k.kind}
                  onClick={() => setKind(k.kind)}
                  icon={k.icon}
                  tone={k.tone}
                  title={KIND_META[k.kind].label}
                  subtitle={k.short}
                />
              ))}
            </div>

            {/* موجودی آغازین — ۲ کارت جمع‌وشونده کوچک‌تر */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-amber-300/70 bg-amber-50/40 p-2 dark:border-amber-800/60 dark:bg-amber-950/15">
              <p className="col-span-2 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                <History className="h-3 w-3" />
                موجودی آغازین دفتر (اختیاری)
              </p>
              {OPENING_KINDS.map((k) => (
                <KindCard
                  key={k.kind}
                  compact
                  selected={kind === k.kind}
                  onClick={() => setKind(k.kind)}
                  icon={History}
                  tone="amber"
                  title={k.label}
                />
              ))}
            </div>

            {/* اثر بر مانده */}
            <div
              className={cn(
                "flex items-start gap-1.5 rounded-md p-2 text-[11px] leading-relaxed",
                meta.receivedLike
                  ? "bg-rose-50 text-rose-800 dark:bg-rose-950/25 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300"
              )}
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {isCurrentKind
                  ? meta.receivedLike
                    ? "اثر بر مانده: بدهی شما به این طرف حساب زیاد (یا طلب شما کم) می‌شود."
                    : "اثر بر مانده: طلب شما از این طرف حساب زیاد (یا بدهی شما کم) می‌شود."
                  : "موجودی آغازین برای وارد کردن بدهی/طلب قدیمی به دفتر است."}
              </span>
            </div>
          </div>

          {/* طرف حساب */}
          <div className="space-y-2">
            <Label>
              طرف حساب <span className="text-rose-500" aria-hidden>*</span>
            </Label>
            <Select value={counterpartyId} onValueChange={handleCounterpartyChange}>
              <SelectTrigger
                ref={cpTriggerRef}
                aria-invalid={!!fieldErrors.cp}
                aria-describedby={fieldErrors.cp ? "cp-error" : undefined}
                className="h-11"
              >
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
                  <SelectLabel className="text-[11px]">
                    حساب‌های مشترک (با اجازه ادمین)
                  </SelectLabel>
                  {sharedCps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.displayName}
                        {c.linkedUserId && (
                          <Badge
                            variant="outline"
                            className="h-4 gap-0.5 px-1 text-[9px] border-emerald-300 text-emerald-700"
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
            {fieldErrors.cp && (
              <p
                id="cp-error"
                role="alert"
                className="text-[11px] font-medium text-rose-600 dark:text-rose-400"
              >
                {fieldErrors.cp}
              </p>
            )}
            {selectedCp?.linkedUserId && (
              <div className="flex items-start gap-1.5 rounded-md bg-emerald-50 p-2 text-[11px] leading-relaxed text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  این طرف حساب به کاربر «{selectedCp.linkedUsername}» لینک است؛
                  او این رکورد را در بخش «حساب دیگران» خود می‌بیند و می‌تواند
                  روی همین ردیف کامنت بگذارد.
                </span>
              </div>
            )}
            {selectedCp && !selectedCp.isShared && (
              <div className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>طرف‌حساب شخصی شما — فقط در دفتر خودتان قابل استفاده است.</span>
              </div>
            )}
          </div>

          {/* دسته‌بندی */}
          <div className="space-y-2">
            <Label>دسته‌بندی (اختیاری)</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="بدون دسته" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>بدون دسته</SelectItem>
                {availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-1.5">
                      {c.name}
                      {c.counterpartyId ? (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] gap-0.5 border-primary/40 text-primary"
                        >
                          مخصوص این طرف‌حساب
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[9px] gap-0.5 text-muted-foreground"
                        >
                          عمومی
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!counterpartyId && (
              <div className="text-[11px] text-muted-foreground">
                ابتدا طرف‌حساب را انتخاب کنید تا دسته‌های قابل استفاده نمایش داده شوند.
              </div>
            )}
            {counterpartyId && availableCategories.length === 0 && (
              <div className="text-[11px] text-muted-foreground">
                هیچ دسته‌ای برای این طرف‌حساب قابل استفاده نیست — از منوی «تنظیمات من»
                می‌توانید دسته عمومی یا مخصوص این طرف‌حساب بسازید.
              </div>
            )}
            {counterpartyId && availableCategories.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {toPersianDigits(availableCategories.length.toString())} دسته قابل
                انتخاب (عمومی + مخصص این طرف‌حساب).
              </div>
            )}
          </div>

          {/* مبلغ + چیپ‌های سریع */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              مبلغ <span className="text-rose-500" aria-hidden>*</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                ref={amountInputRef}
                dir="ltr"
                aria-invalid={!!fieldErrors.amount}
                aria-describedby={fieldErrors.amount ? "amount-error" : undefined}
                className="h-12 pl-16 text-right text-lg font-bold tracking-wide"
                placeholder="۰"
                value={amountRaw}
                onChange={(e) => handleAmountChange(e.target.value)}
                inputMode="numeric"
                disabled={submitting}
              />
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-muted-foreground">
                تومان
              </span>
            </div>
            {/* چیپ‌های مبلغ سریع */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => addQuickAmount(q.value)}
                  disabled={submitting}
                  className="rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  + {q.label}
                </button>
              ))}
            </div>
            {fieldErrors.amount && (
              <p
                id="amount-error"
                role="alert"
                className="text-[11px] font-medium text-rose-600 dark:text-rose-400"
              >
                {fieldErrors.amount}
              </p>
            )}
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
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  مانده فعلی با {selectedCp?.displayName}:
                </span>
                {selectedBalance.net > 0 ? (
                  <Badge className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    بدهی{" "}
                    {toPersianDigits(
                      Math.abs(selectedBalance.net).toLocaleString("en-US")
                    )}{" "}
                    ت
                  </Badge>
                ) : selectedBalance.net < 0 ? (
                  <Badge className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    طلب{" "}
                    {toPersianDigits(
                      Math.abs(selectedBalance.net).toLocaleString("en-US")
                    )}{" "}
                    ت
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full">
                    تسویه
                  </Badge>
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
        </div>

        {/* ┌ فوتر چسبان — دکمه ثبت همیشه در دید ┐ */}
        <DrawerFooter className="shrink-0 flex-col gap-2 border-t bg-card/80 p-4 pt-3 backdrop-blur-md sm:flex-row sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto sm:px-6"
            onClick={onClose}
            disabled={submitting}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            className="h-12 w-full flex-1 text-base font-bold shadow-fab sm:h-11 sm:flex-none sm:text-sm"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="ml-2 h-4 w-4" />
            )}
            {isEdit ? "ذخیره تغییرات" : "ثبت تراکنش"}
          </Button>
        </DrawerFooter>
      </form>
    </>
  );
}
