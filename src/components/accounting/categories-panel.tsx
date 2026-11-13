"use client";

// پنل «تنظیمات من» — نسخه ۳.۰
// ============================================================
// برای هر کاربر (ادمین و عادی): مدیریت دسته‌بندی‌های شخصی و
// طرف‌حساب‌های شخصیِ دفتر خودِ کاربر. هیچ داده‌ای از کاربران دیگر
// در این پنل نمایش یا ویرایش نمی‌شود.
//
// قراردادها:
//   - رندر: سابسکرایب زنده‌ی استور با useAccountingStore((s) => s.xxx)
//   - داخل asyncها: useAccountingStore.getState()
//   - رنگ برند از توکن primary (قالب انتخابی) + رنگ‌های معنایی rose/amber
//   - ارقام فارسی با toPersianDigits

import { useMemo, useState } from "react";
import {
  Tags,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Contact as ContactIcon,
  UserCog,
  Link2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import type { Category, Counterparty } from "@/lib/accounting/types";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";
import { AppearanceSettingsCard } from "./appearance-settings-card";

export function PersonalSettingsPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex items-start gap-2 dark:border-primary/25 dark:bg-primary/10">
        <UserCog className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          تنظیمات من — دسته‌بندی‌ها و طرف‌حساب‌های شخصی خودتان را اینجا مدیریت
          کنید؛ این موارد فقط به دفتر شما تعلق دارند و برای بقیه کاربران
          نمایش داده نمی‌شوند.
        </div>
      </div>
      <AppearanceSettingsCard />
      <MyCategoriesSection />
      <MyPrivateCounterpartiesSection />
    </div>
  );
}

// ===========================================================================
// بخش ۱ — دسته‌بندی‌های من
// ===========================================================================

function MyCategoriesSection() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const counterparties = useAccountingStore((s) => s.counterparties);

  const myCategories = currentUserId
    ? categories.filter((c) => c.userId === currentUserId)
    : [];

  // گروه‌بندی برای شمارش: چند دسته عمومی، چند مخصوص
  const generalCount = myCategories.filter((c) => !c.counterpartyId).length;
  const specificCount = myCategories.length - generalCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-primary" />
          دسته‌بندی‌های من
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(myCategories.length.toString())} دسته
          </Badge>
        </CardTitle>
        <CardDescription>
          دسته‌های شخصی شما برای طبقه‌بندی تراکنش‌ها؛ در فرم ثبت تراکنش قابل
          انتخاب‌اند. هر دسته می‌تواند «عمومی» (همه طرف‌حساب‌ها) یا «مخصوص»
          (یک طرف‌حساب مشخص) باشد.
        </CardDescription>
        {myCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              عمومی: {toPersianDigits(generalCount.toString())} دسته
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="inline-flex items-center gap-1">
              <ContactIcon className="h-3 w-3" />
              مخصوص: {toPersianDigits(specificCount.toString())} دسته
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96 scrollbar-persian">
          <ul className="divide-y">
            {myCategories.length === 0 ? (
              <li className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                <Tags className="h-8 w-8 text-muted-foreground/60" />
                <div className="text-sm text-muted-foreground">
                  هنوز دسته‌ای نساخته‌اید — با «افزودن دسته» اولین دسته شخصی
                  خود را بسازید تا در فرم ثبت تراکنش قابل انتخاب شود.
                </div>
              </li>
            ) : (
              myCategories.map((cat) => {
                // تراکنش‌های خودِ کاربر که با این دسته ثبت شده‌اند
                const txnCount = transactions.filter(
                  (t) =>
                    t.categoryId === cat.id && t.userId === currentUserId
                ).length;
                // نام طرف‌حساب (اگر مخصوص است)
                const cp = cat.counterpartyId
                  ? counterparties.find((c) => c.id === cat.counterpartyId)
                  : null;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{cat.name}</span>
                        {cat.counterpartyId ? (
                          <Badge
                            variant="outline"
                            className="h-5 text-[10px] gap-0.5 border-primary/40 text-primary"
                          >
                            <ContactIcon className="h-2.5 w-2.5" />
                            {cp?.displayName ?? "طرف‌حساب حذف‌شده"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-5 text-[10px] gap-0.5 text-muted-foreground"
                          >
                            <Globe className="h-2.5 w-2.5" />
                            عمومی
                          </Badge>
                        )}
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {toPersianDigits(txnCount.toString())} تراکنش
                        </Badge>
                      </div>
                      {cat.counterpartyId && cp && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          فقط در تراکنش‌های با «{cp.displayName}» قابل انتخاب
                        </div>
                      )}
                      {cat.counterpartyId && !cp && (
                        <div className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          طرف‌حساب مرتبط حذف شده است؛ این دسته دیگر قابل استفاده نیست
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <EditCategoryDialog category={cat} />
                      <DeleteCategoryDialog
                        category={cat}
                        txnCount={txnCount}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>
        <div className="p-3 border-t">
          <AddCategoryDialog />
        </div>
      </CardContent>
    </Card>
  );
}

function AddCategoryDialog() {
  const { toast } = useToast();
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // scope: "general" → عمومی، "specific" → مخصوص یک طرف‌حساب
  const [scope, setScope] = useState<"general" | "specific">("general");
  const [cpId, setCpId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setScope("general");
    setCpId("");
    setSubmitting(false);
  }

  // طرف‌حساب‌های قابل استفاده برای ساخت دسته‌ی مخصوص
  const usableCps = useMemo(() => {
    if (!currentUserId) return [];
    const state = useAccountingStore.getState();
    return counterparties.filter((c) => {
      if (c.archivedAt) return false;
      if (c.linkedUserId === currentUserId) return false;
      if (!c.isShared) return c.ownerUserId === currentUserId;
      const me = state.users.find((u) => u.id === currentUserId);
      if (me?.role === "admin") return true;
      return state.grants.some(
        (g) => g.userId === currentUserId && g.counterpartyId === c.id
      );
    });
  }, [counterparties, currentUserId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { currentUserId, addCategory } = useAccountingStore.getState();
    if (!currentUserId) return;
    if (scope === "specific" && !cpId) {
      toast({
        title: "خطا",
        description: "برای دسته‌ی مخصوص، انتخاب طرف‌حساب الزامی است.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const result = await addCategory(
      name,
      scope === "specific" ? cpId : null
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "خطا",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    reset();
    toast({
      title: "دسته ایجاد شد",
      description:
        scope === "specific"
          ? `«${name.trim()}» به‌عنوان دسته‌ی مخصوص این طرف‌حساب افزوده شد.`
          : `«${name.trim()}» به‌عنوان دسته‌ی عمومی (قابل استفاده با همه طرف‌حساب‌ها) افزوده شد.`,
    });
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
        <Button className="w-full">
          <Plus className="h-4 w-4 ml-2" />
          افزودن دسته
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            افزودن دسته شخصی
          </DialogTitle>
          <DialogDescription>
            دسته را «عمومی» (قابل استفاده با همه طرف‌حساب‌ها) یا «مخصوص»
            (فقط برای یک طرف‌حساب مشخص) بسازید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ac-name">نام دسته</Label>
            <Input
              id="ac-name"
              placeholder="مثلاً خواروبار، کرایه، هدیه"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* انتخاب scope */}
          <div className="space-y-2">
            <Label>نوع دسته</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("general")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all",
                  scope === "general"
                    ? "border-primary bg-accent/60 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
                aria-pressed={scope === "general"}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Tags className="h-3.5 w-3.5 text-primary" />
                  عمومی
                </div>
                <div className="text-[10px] leading-4 text-muted-foreground">
                  قابل استفاده با همه طرف‌حساب‌ها
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScope("specific")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all",
                  scope === "specific"
                    ? "border-primary bg-accent/60 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
                aria-pressed={scope === "specific"}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ContactIcon className="h-3.5 w-3.5 text-primary" />
                  مخصوص طرف‌حساب
                </div>
                <div className="text-[10px] leading-4 text-muted-foreground">
                  فقط برای یک طرف‌حساب مشخص
                </div>
              </button>
            </div>
          </div>

          {/* اگر مخصوص انتخاب شد، طرف‌حساب را انتخاب کن */}
          {scope === "specific" && (
            <div className="space-y-2">
              <Label>
                طرف‌حساب <span className="text-rose-500" aria-hidden>*</span>
              </Label>
              <Select value={cpId} onValueChange={setCpId} disabled={submitting}>
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={
                      usableCps.length === 0
                        ? "هیچ طرف‌حسابی در دسترس نیست"
                        : "یک طرف‌حساب انتخاب کنید"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {usableCps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                      {c.linkedUsername && (
                        <Badge
                          variant="outline"
                          className="h-4 gap-0.5 px-1 text-[9px] ms-1 border-emerald-300 text-emerald-700"
                        >
                          <Link2 className="h-2 w-2" />
                          {c.linkedUsername}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usableCps.length === 0 && (
                <div className="text-[11px] text-muted-foreground">
                  هیچ طرف‌حسابی در دسترس شما نیست — ادمین باید دسترسی بدهد یا
                  ابتدا یک طرف‌حساب شخصی بسازید.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              ثبت دسته
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category }: { category: Category }) {
  const { toast } = useToast();
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  // scope: "general" → عمومی، "specific" → مخصوص یک طرف‌حساب
  const [scope, setScope] = useState<"general" | "specific">(
    category.counterpartyId ? "specific" : "general"
  );
  const [cpId, setCpId] = useState<string>(category.counterpartyId ?? "");
  const [submitting, setSubmitting] = useState(false);

  // طرف‌حساب‌های قابل استفاده برای scope مخصوص
  const usableCps = useMemo(() => {
    if (!currentUserId) return [];
    const state = useAccountingStore.getState();
    return counterparties.filter((c) => {
      if (c.archivedAt) return false;
      if (c.linkedUserId === currentUserId) return false;
      if (!c.isShared) return c.ownerUserId === currentUserId;
      const me = state.users.find((u) => u.id === currentUserId);
      if (me?.role === "admin") return true;
      return state.grants.some(
        (g) => g.userId === currentUserId && g.counterpartyId === c.id
      );
    });
  }, [counterparties, currentUserId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { currentUserId, updateCategory } = useAccountingStore.getState();
    if (!currentUserId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "خطا",
        description: "نام دسته الزامی است.",
        variant: "destructive",
      });
      return;
    }
    if (scope === "specific" && !cpId) {
      toast({
        title: "خطا",
        description: "برای دسته‌ی مخصوص، انتخاب طرف‌حساب الزامی است.",
        variant: "destructive",
      });
      return;
    }
    // تشخیص تغییرات
    const nextCpId = scope === "specific" ? cpId : null;
    const nameChanged = trimmed !== category.name;
    const scopeChanged = nextCpId !== (category.counterpartyId ?? null);
    if (!nameChanged && !scopeChanged) {
      toast({
        title: "تغییری اعمال نشد",
        description: "هیچ فیلدی تغییر نکرده است.",
      });
      setOpen(false);
      return;
    }
    setSubmitting(true);
    const patch: { name?: string; counterpartyId?: string | null } = {};
    if (nameChanged) patch.name = trimmed;
    if (scopeChanged) patch.counterpartyId = nextCpId;
    const result = await updateCategory(category.id, patch);
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "خطا",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    toast({
      title: "به‌روزرسانی شد",
      description:
        scope === "specific"
          ? `دسته «${trimmed}» به‌عنوان مخصوص این طرف‌حساب ذخیره شد.`
          : `دسته «${trimmed}» به‌عنوان عمومی ذخیره شد.`,
    });
  }

  // وقتی دیالوگ باز می‌شود، مقادیر را از category بازخوانی کن
  function syncFromCategory() {
    setName(category.name);
    setScope(category.counterpartyId ? "specific" : "general");
    setCpId(category.counterpartyId ?? "");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) syncFromCategory();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="ویرایش"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            ویرایش دسته «{category.name}»
          </DialogTitle>
          <DialogDescription>
            می‌توانید نام دسته یا نوع آن (عمومی/مخصوص) را تغییر دهید. اگر دسته
            از «مخصوص» به «عمومی» تبدیل شود، با همه طرف‌حساب‌ها قابل استفاده
            می‌شود و تراکنش‌های ثبت‌شده با آن دست‌نخورده باقی می‌مانند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`ec-name-${category.id}`}>نام دسته</Label>
            <Input
              id={`ec-name-${category.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* انتخاب scope */}
          <div className="space-y-2">
            <Label>نوع دسته</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("general")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all",
                  scope === "general"
                    ? "border-primary bg-accent/60 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
                aria-pressed={scope === "general"}
                disabled={submitting}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  عمومی
                </div>
                <div className="text-[10px] leading-4 text-muted-foreground">
                  همه طرف‌حساب‌ها
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScope("specific")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition-all",
                  scope === "specific"
                    ? "border-primary bg-accent/60 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                )}
                aria-pressed={scope === "specific"}
                disabled={submitting}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ContactIcon className="h-3.5 w-3.5 text-primary" />
                  مخصوص طرف‌حساب
                </div>
                <div className="text-[10px] leading-4 text-muted-foreground">
                  فقط یک طرف‌حساب
                </div>
              </button>
            </div>
          </div>

          {/* اگر مخصوص انتخاب شد، طرف‌حساب را انتخاب کن */}
          {scope === "specific" && (
            <div className="space-y-2">
              <Label>
                طرف‌حساب <span className="text-rose-500" aria-hidden>*</span>
              </Label>
              <Select value={cpId} onValueChange={setCpId} disabled={submitting}>
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={
                      usableCps.length === 0
                        ? "هیچ طرف‌حسابی در دسترس نیست"
                        : "یک طرف‌حساب انتخاب کنید"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {usableCps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                      {c.linkedUsername && (
                        <Badge
                          variant="outline"
                          className="h-4 gap-0.5 px-1 text-[9px] ms-1 border-emerald-300 text-emerald-700"
                        >
                          <Link2 className="h-2 w-2" />
                          {c.linkedUsername}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usableCps.length === 0 && (
                <div className="text-[11px] text-muted-foreground">
                  هیچ طرف‌حسابی در دسترس شما نیست.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  category,
  txnCount,
}: {
  category: Category;
  txnCount: number;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    const { currentUserId, deleteCategory } = useAccountingStore.getState();
    if (!currentUserId) return;
    const result = await deleteCategory(category.id);
    setOpen(false);
    if (!result.ok) {
      toast({
        title: "خطا",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "دسته حذف شد",
      description:
        txnCount > 0
          ? `«${category.name}» حذف شد؛ تراکنش‌های آن بدون دسته شدند.`
          : `«${category.name}» حذف شد.`,
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          title="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            حذف دسته «{category.name}»؟
          </AlertDialogTitle>
          <AlertDialogDescription>
            {txnCount > 0
              ? `این دسته روی ${toPersianDigits(
                  txnCount.toString()
                )} تراکنش اعمال شده است؛ تراکنش‌های این دسته بدون دسته می‌شوند ولی حذف نمی‌شوند.`
              : "هیچ تراکنشی با این دسته ثبت نشده است. این عملیات قابل بازگشت نیست."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-rose-600 hover:bg-rose-700"
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ===========================================================================
// بخش ۲ — طرف‌حساب‌های شخصی من
// ===========================================================================

function MyPrivateCounterpartiesSection() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);

  const myPrivateCps = currentUserId
    ? counterparties.filter(
        (c) => !c.isShared && c.ownerUserId === currentUserId
      )
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ContactIcon className="h-4 w-4 text-primary" />
          طرف‌حساب‌های شخصی من
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(myPrivateCps.length.toString())} مورد
          </Badge>
        </CardTitle>
        <CardDescription>
          این طرف‌حساب‌ها فقط در دفتر خودتان قابل استفاده‌اند؛ برای بقیه
          کاربران، اتصال تلگرام و لیست‌های مشترک دیده نمی‌شوند.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96 scrollbar-persian">
          <ul className="divide-y">
            {myPrivateCps.length === 0 ? (
              <li className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                <ContactIcon className="h-8 w-8 text-muted-foreground/60" />
                <div className="text-sm text-muted-foreground">
                  هنوز طرف‌حساب شخصی ندارید — با «افزودن طرف‌حساب شخصی»
                  افراد مخصوص دفتر خودتان را ثبت کنید؛ این موارد برای بقیه
                  کاربران دیده نمی‌شوند.
                </div>
              </li>
            ) : (
              myPrivateCps.map((c) => {
                const txnCount = transactions.filter(
                  (t) => t.counterpartyId === c.id
                ).length;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{c.displayName}</span>
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {toPersianDigits(txnCount.toString())} تراکنش
                        </Badge>
                      </div>
                      {c.notes ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {c.notes}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DeletePrivateCpDialog cp={c} txnCount={txnCount} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>
        <div className="p-3 border-t">
          <AddPrivateCpDialog />
        </div>
      </CardContent>
    </Card>
  );
}

function AddPrivateCpDialog() {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDisplayName("");
    setNotes("");
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { currentUserId, addPrivateCounterparty } =
      useAccountingStore.getState();
    if (!currentUserId) return;
    setSubmitting(true);
    const result = await addPrivateCounterparty(
      displayName,
      notes || undefined
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({
        title: "خطا",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    reset();
    toast({
      title: "طرف‌حساب شخصی ایجاد شد",
      description: `«${displayName.trim()}» فقط در دفتر خودتان قابل استفاده است.`,
    });
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
        <Button className="w-full">
          <Plus className="h-4 w-4 ml-2" />
          افزودن طرف‌حساب شخصی
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-primary" />
            افزودن طرف‌حساب شخصی
          </DialogTitle>
          <DialogDescription>
            این طرف‌حساب فقط در دفتر خودتان قابل استفاده است و برای بقیه
            کاربران (اتصال تلگرام و لیست‌های مشترک) دیده نمی‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pc-name">نام طرف حساب</Label>
            <Input
              id="pc-name"
              placeholder="مثلاً تعمیرکار خودرو یا همسایه"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pc-notes">یادداشت (اختیاری)</Label>
            <Input
              id="pc-notes"
              placeholder="مثلاً شماره تماس یا توضیح کوتاه"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              افزودن
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeletePrivateCpDialog({
  cp,
  txnCount,
}: {
  cp: Counterparty;
  txnCount: number;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    const { currentUserId, deletePrivateCounterparty } =
      useAccountingStore.getState();
    if (!currentUserId) return;
    const result = await deletePrivateCounterparty(cp.id);
    setOpen(false);
    if (!result.ok) {
      toast({
        title: "خطا",
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "حذف شد",
      description: `«${cp.displayName}» از طرف‌حساب‌های شخصی شما حذف شد.`,
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          title="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            حذف طرف‌حساب «{cp.displayName}»؟
          </AlertDialogTitle>
          <AlertDialogDescription>
            {txnCount > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                این طرف‌حساب {toPersianDigits(txnCount.toString())} تراکنش
                ثبت‌شده دارد؛ تا زمانی که تراکنش‌های آن حذف نشوند، امکان حذف
                آن وجود ندارد.
              </span>
            ) : (
              "این عملیات قابل بازگشت نیست. این طرف‌حساب فقط در دفتر خودتان قابل استفاده بود. آیا مطمئن هستید؟"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-rose-600 hover:bg-rose-700"
            disabled={txnCount > 0}
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
