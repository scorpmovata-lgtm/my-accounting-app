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
//   - رنگ‌ها فقط emerald / rose / amber / muted (آبی و بنفش ممنوع)
//   - ارقام فارسی با toPersianDigits

import { useState } from "react";
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

export function PersonalSettingsPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3 flex items-start gap-2">
        <UserCog className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-800 dark:text-emerald-300">
          تنظیمات من — دسته‌بندی‌ها و طرف‌حساب‌های شخصی خودتان را اینجا مدیریت
          کنید؛ این موارد فقط به دفتر شما تعلق دارند و برای بقیه کاربران
          نمایش داده نمی‌شوند.
        </div>
      </div>
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

  const myCategories = currentUserId
    ? categories.filter((c) => c.userId === currentUserId)
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          دسته‌بندی‌های من
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(myCategories.length.toString())} دسته
          </Badge>
        </CardTitle>
        <CardDescription>
          دسته‌های شخصی شما برای طبقه‌بندی تراکنش‌ها؛ در فرم ثبت تراکنش قابل
          انتخاب‌اند.
        </CardDescription>
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
                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {toPersianDigits(txnCount.toString())} تراکنش
                        </Badge>
                      </div>
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

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { currentUserId, addCategory } = useAccountingStore.getState();
    if (!currentUserId) return;
    setSubmitting(true);
    const result = await addCategory(name);
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
      description: `«${name.trim()}» به دسته‌های شخصی شما افزوده شد.`,
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
            <Tags className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            افزودن دسته شخصی
          </DialogTitle>
          <DialogDescription>
            نام دسته را وارد کنید؛ این دسته فقط در دفتر شما قابل استفاده است
            و در فرم ثبت تراکنش قابل انتخاب خواهد بود.
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

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === category.name) {
      toast({
        title: "تغییری اعمال نشد",
        description: "نام دسته تغییر نکرده است.",
      });
      setOpen(false);
      return;
    }
    const { currentUserId, renameCategory } = useAccountingStore.getState();
    if (!currentUserId) return;
    setSubmitting(true);
    const result = await renameCategory(category.id, trimmed);
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
      description: `نام دسته به «${trimmed}» تغییر یافت.`,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName(category.name);
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
            <Pencil className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ویرایش دسته «{category.name}»
          </DialogTitle>
          <DialogDescription>
            نام جدید دسته را وارد کنید؛ تراکنش‌های ثبت‌شده با این دسته
            دست‌نخورده باقی می‌مانند.
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
          <ContactIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
            <ContactIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
