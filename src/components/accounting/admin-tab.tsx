"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Contact as ContactIcon,
  Link2,
  Plus,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  Lock,
  Share2,
  X,
  Database,
  Download,
  Mail,
  FileSpreadsheet,
  Upload,
  Calendar,
  Clock,
  Tag,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
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
import { Switch } from "@/components/ui/switch";
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
import {
  ROLE_LABELS,
  SCOPE_SHORT,
  KIND_LABELS,
  KIND_META,
  type UserScope,
  type UserRole,
  type Transaction,
} from "@/lib/accounting/types";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { APP_VERSION } from "@/lib/version";
import { AdminTelegramSection } from "./admin-telegram-section";
import { AppearanceSettingsCard } from "./appearance-settings-card";
import { triggerBackupEmailReal } from "@/lib/supabase/real";

export function AdminTab() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex items-start gap-2 dark:border-primary/25 dark:bg-primary/10">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          پنل مدیریت سامانه — کاربران، دسترسی طرف‌حساب‌های مشترک، فعال/غیرفعال‌سازی
          و ربات تلگرام. هر کاربر در دفتر مستقل خودش ثبت می‌کند و دیگرانِ لینک‌شده
          رکوردهای او را می‌بینند.
        </div>
      </div>
      <AppearanceSettingsCard />
      <UsersSection />
      <AdminTelegramSection />
      <AccessGrantsSection />
      <CounterpartiesSection />
      <BackupSection />
      <ExcelImportExportSection />
    </div>
  );
}

// ===========================================================================
// بخش کاربران
// ===========================================================================

function UsersSection() {
  const users = useAccountingStore((s) => s.users);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const updateUser = useAccountingStore((s) => s.updateUser);
  const { toast } = useToast();

  // یافتن طرف حسابِ لینک‌شده به هر کاربر (ازطرف cp.linkedUserId)
  function cpForUser(userId: string) {
    return counterparties.find((c) => c.linkedUserId === userId);
  }

  async function toggleActive(
    u: import("@/lib/accounting/types").User,
    next: boolean
  ) {
    if (!currentUserId) return;
    const res = await updateUser(u.id, { isActive: next }, currentUserId);
    if (!res.ok) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: next ? "کاربر فعال شد" : "کاربر غیرفعال شد",
      description: next
        ? `«${u.displayName}» می‌تواند وارد شود.`
        : `«${u.displayName}» دیگر نمی‌تواند وارد شود و ربات تلگرامش هم خاموش می‌شود.`,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          کاربران سامانه
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(users.length.toString())} نفر
          </Badge>
        </CardTitle>
        <CardDescription>
          هر کاربر با نام کاربری و رمز عبور وارد می‌شود. ادمین دسترسی کامل،
          کاربر عادی بر اساس سطح دسترسی محدود می‌شود.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <ul className="divide-y">
            {users.map((u) => {
              const cp = cpForUser(u.id);
              const isMe = u.id === currentUserId;
              const inactive = u.isActive === false;
              return (
                <li
                  key={u.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${
                    inactive ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${inactive ? "line-through decoration-rose-400/70" : ""}`}>
                        {u.displayName}
                      </span>
                      {u.role === "admin" ? (
                        <Badge className="h-5 bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary">
                          {ROLE_LABELS.admin}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5">
                          {ROLE_LABELS.user}
                        </Badge>
                      )}
                      {u.role === "user" && u.scope && (
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          {SCOPE_SHORT[u.scope]}
                        </Badge>
                      )}
                      {inactive && (
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] gap-1 border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400"
                        >
                          <UserX className="h-3 w-3" />
                          غیرفعال
                        </Badge>
                      )}
                      {isMe && (
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          شما
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="font-mono" dir="ltr">
                        {u.username}
                      </span>
                      {cp ? (
                        <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                          <Link2 className="h-3 w-3" />
                          طرف حساب: {cp.displayName}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          بدون طرف حساب لینک‌شده
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        inactive
                          ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          : "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      }`}
                      disabled={isMe}
                      title={
                        isMe
                          ? "حساب خودتان را نمی‌توانید غیرفعال کنید"
                          : inactive
                          ? "فعال‌سازی کاربر"
                          : "غیرفعال‌سازی کاربر (ورود مسدود می‌شود)"
                      }
                      aria-label={inactive ? "فعال‌سازی" : "غیرفعال‌سازی"}
                      onClick={() => void toggleActive(u, inactive)}
                    >
                      {inactive ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserX className="h-4 w-4" />
                      )}
                    </Button>
                    <EditUserDialog user={u} disabled={isMe} />
                    <DeleteUserDialog user={u} disabled={isMe} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="p-3 border-t">
          <CreateUserDialog />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateUserDialog() {
  const addUser = useAccountingStore((s) => s.addUser);
  const addCounterparty = useAccountingStore((s) => s.addCounterparty);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [scope, setScope] = useState<UserScope>("transaction_list");
  const [makeCounterparty, setMakeCounterparty] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setUsername("");
    setPassword("");
    setDisplayName("");
    setRole("user");
    setScope("transaction_list");
    setMakeCounterparty(true);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    const result = await addUser(
      {
        username,
        password,
        displayName,
        role,
        scope: role === "user" ? scope : undefined,
      },
      currentUserId
    );
    if (!result.ok || !result.user) {
      setSubmitting(false);
      toast({ title: "خطا", description: result.error, variant: "destructive" });
      return;
    }
    // ایجاد طرف حساب هم‌نام و لینک (اگر خواسته شده)
    if (makeCounterparty) {
      const cpRes = await addCounterparty(
        { displayName: displayName.trim(), linkedUserId: result.user.id },
        currentUserId
      );
      if (!cpRes.ok) {
        toast({
          title: "کاربر ساخته شد ولی طرف حساب نه",
          description: cpRes.error,
          variant: "destructive",
        });
      }
    }
    setSubmitting(false);
    setOpen(false);
    reset();
    toast({
      title: "کاربر ایجاد شد",
      description: `«${displayName}» با نام کاربری ${username} ساخته شد.`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus className="h-4 w-4 ml-2" />
          افزودن کاربر
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            افزودن کاربر جدید
          </DialogTitle>
          <DialogDescription>
            نام کاربری و رمز عبور را تعیین کنید. کاربر با این اطلاعات وارد
            می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nu-username">نام کاربری</Label>
            <Input
              id="nu-username"
              dir="ltr"
              className="text-right"
              placeholder="vahid"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-displayName">نام نمایشی</Label>
            <Input
              id="nu-displayName"
              placeholder="وحید"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-password">رمز عبور</Label>
            <Input
              id="nu-password"
              dir="ltr"
              className="text-right"
              placeholder="••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
              minLength={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>نقش</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
                disabled={submitting}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">کاربر</SelectItem>
                  <SelectItem value="admin">ادمین</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "user" && (
              <div className="space-y-2">
                <Label>سطح دسترسی</Label>
                <Select
                  value={scope}
                  onValueChange={(v) => setScope(v as UserScope)}
                  disabled={submitting}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balance_only">فقط مشاهده مانده</SelectItem>
                    <SelectItem value="transaction_list">
                      مانده + تراکنش‌ها
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="text-sm font-medium">ایجاد طرف حساب هم‌نام</div>
                <div className="text-[11px] text-muted-foreground">
                  یک طرف حساب با همین نام بساز و به این کاربر لینک کن
                </div>
              </div>
            </div>
            <Switch
              checked={makeCounterparty}
              onCheckedChange={setMakeCounterparty}
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
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              ایجاد کاربر
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  disabled,
}: {
  user: import("@/lib/accounting/types").User;
  disabled?: boolean;
}) {
  const updateUser = useAccountingStore((s) => s.updateUser);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<UserScope>(
    user.scope ?? "transaction_list"
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 150));
    const patch: Partial<
      import("@/lib/accounting/types").User
    > = {};
    if (displayName.trim() && displayName !== user.displayName) {
      patch.displayName = displayName.trim();
    }
    if (password) patch.password = password;
    if (user.role === "user" && scope !== user.scope) patch.scope = scope;

    if (Object.keys(patch).length === 0) {
      toast({ title: "تغییری اعمال نشد", description: "هیچ فیلدی تغییر نکرده است." });
      setSubmitting(false);
      setOpen(false);
      return;
    }
    const result = await updateUser(user.id, patch, currentUserId);
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: "خطا", description: result.error, variant: "destructive" });
      return;
    }
    setOpen(false);
    setPassword("");
    toast({ title: "به‌روزرسانی شد", description: `«${user.displayName}» ویرایش شد.` });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          title={disabled ? "نمی‌توانید خودتان را ویرایش کنید" : "ویرایش"}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            ویرایش کاربر «{user.displayName}»
          </DialogTitle>
          <DialogDescription>
            نام کاربری قابل تغییر نیست. نام نمایشی، رمز عبور و سطح دسترسی را
            به‌روز کنید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>نام نمایشی</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>رمز عبور جدید (اختیاری)</Label>
            <div className="relative">
              <KeyRound className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                dir="ltr"
                className="text-right pr-8"
                placeholder="خالی = بدون تغییر"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                minLength={4}
              />
            </div>
          </div>
          {user.role === "user" && (
            <div className="space-y-2">
              <Label>سطح دسترسی</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as UserScope)}
                disabled={submitting}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance_only">فقط مشاهده مانده</SelectItem>
                  <SelectItem value="transaction_list">
                    مانده + تراکنش‌ها
                  </SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
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

function DeleteUserDialog({
  user,
  disabled,
}: {
  user: import("@/lib/accounting/types").User;
  disabled?: boolean;
}) {
  const deleteUser = useAccountingStore((s) => s.deleteUser);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    if (!currentUserId) return;
    const result = await deleteUser(user.id, currentUserId);
    if (!result.ok) {
      toast({
        title: "حذف ناموفق",
        description: result.error ?? "خطای ناشناخته",
        variant: "destructive",
      });
      return; // دیالوگ باز می‌ماند تا کاربر خطا را بخواند
    }
    setOpen(false);
    toast({
      title: "کاربر حذف شد",
      description: `«${user.displayName}» حذف شد — تراکنش‌ها و طرف‌حساب‌های ایشان به شما منتقل شد.`,
      variant: "destructive",
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          disabled={disabled}
          title={disabled ? "نمی‌توانید خودتان را حذف کنید" : "حذف"}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            حذف کاربر «{user.displayName}»؟
          </AlertDialogTitle>
          <AlertDialogDescription>
            این عملیات قابل بازگشت نیست. تراکنش‌های ثبت‌شده توسط این کاربر
            حفظ می‌شوند. آیا مطمئن هستید؟
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
// بخش طرف حساب‌ها
// ===========================================================================

function CounterpartiesSection() {
  const counterparties = useAccountingStore((s) => s.counterparties);
  const users = useAccountingStore((s) => s.users);
  const transactions = useAccountingStore((s) => s.transactions);

  function userOf(cpId: string) {
    return users.find((u) => {
      const cp = counterparties.find((c) => c.id === cpId);
      return cp?.linkedUserId === u.id;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ContactIcon className="h-4 w-4 text-primary" />
          طرف حساب‌ها
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(counterparties.length.toString())} مورد
          </Badge>
        </CardTitle>
        <CardDescription>
          «مشترک» را ادمین می‌سازد و با بخش «دسترسی طرف‌حساب‌ها» در اختیار
          کاربران می‌گذارد (با یا بدون پنل کاربری). «شخصی» را هر کاربر برای
          خودش می‌سازد و فقط در دفتر خودش دیده می‌شود.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <ul className="divide-y">
            {counterparties.map((c) => {
              const linkedUser = c.linkedUserId
                ? users.find((u) => u.id === c.linkedUserId)
                : null;
              const owner = c.ownerUserId
                ? users.find((u) => u.id === c.ownerUserId)
                : null;
              const txnCount = transactions.filter(
                (t) => t.counterpartyId === c.id
              ).length;
              const shared = c.isShared;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.displayName}</span>
                      {shared ? (
                        <Badge
                          variant="outline"
                          className="h-5 gap-1 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                        >
                          <Share2 className="h-2.5 w-2.5" />
                          مشترک
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-5 gap-1 text-[10px] border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          شخصی — {owner?.displayName ?? "کاربر حذف‌شده"}
                        </Badge>
                      )}
                      {linkedUser ? (
                        <Badge
                          variant="outline"
                          className="h-5 gap-1 px-1.5 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                        >
                          <Link2 className="h-2.5 w-2.5" />
                          {linkedUser.username}
                        </Badge>
                      ) : shared ? (
                        <Badge variant="secondary" className="h-5 text-[10px]">
                          بدون پنل کاربری
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {toPersianDigits(txnCount.toString())} تراکنش
                      {c.notes ? ` — ${c.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {shared && <EditCounterpartyDialog cp={c} />}
                    {shared && <DeleteCounterpartyDialog cp={c} txnCount={txnCount} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="p-3 border-t">
          <CreateCounterpartyDialog />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateCounterpartyDialog() {
  const addCounterparty = useAccountingStore((s) => s.addCounterparty);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedUserId, setLinkedUserId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  // کاربرانی که هنوز به طرف حسابی لینک نشده‌اند
  const linkableUsers = users.filter(
    (u) => !counterparties.some((c) => c.linkedUserId === u.id)
  );

  function reset() {
    setDisplayName("");
    setNotes("");
    setLinkedUserId("none");
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 150));
    const result = await addCounterparty(
      {
        displayName,
        notes: notes || undefined,
        linkedUserId: linkedUserId === "none" ? null : linkedUserId,
      },
      currentUserId
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: "خطا", description: result.error, variant: "destructive" });
      return;
    }
    setOpen(false);
    reset();
    toast({
      title: "طرف حساب ایجاد شد",
      description: `«${displayName}» افزوده شد.`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 ml-2" />
          افزودن طرف حساب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-primary" />
            افزودن طرف حساب
          </DialogTitle>
          <DialogDescription>
            طرف حساب‌ها متمرکز هستند و برای همه کاربران یکسان نمایش داده
            می‌شوند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nc-name">نام طرف حساب</Label>
            <Input
              id="nc-name"
              placeholder="مثلاً وحید یا رضا کریمی"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-notes">یادداشت (اختیاری)</Label>
            <Input
              id="nc-notes"
              placeholder="مثلاً شریک تجاری"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label>لینک به کاربر سامانه (اختیاری)</Label>
            <Select
              value={linkedUserId}
              onValueChange={setLinkedUserId}
              disabled={submitting}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون لینک (شخص عادی)</SelectItem>
                {linkableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.displayName} ({u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkedUserId !== "none" && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                با لینک کردن، تراکنش‌های این طرف حساب با دفتر آن کاربر خودکار
                تطبیق داده می‌شوند.
              </div>
            )}
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
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
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

function EditCounterpartyDialog({
  cp,
}: {
  cp: import("@/lib/accounting/types").Counterparty;
}) {
  const updateCounterparty = useAccountingStore((s) => s.updateCounterparty);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(cp.displayName);
  const [notes, setNotes] = useState(cp.notes ?? "");
  const [linkedUserId, setLinkedUserId] = useState<string>(
    cp.linkedUserId ?? "none"
  );
  const [submitting, setSubmitting] = useState(false);

  // قابل لینک: کاربرانی که هنوز لینک نشده‌اند، به‌علاوه کاربر فعلیِ این cp
  const linkableUsers = users.filter(
    (u) =>
      u.id === cp.linkedUserId ||
      !counterparties.some((c) => c.id !== cp.id && c.linkedUserId === u.id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 150));
    const result = await updateCounterparty(
      cp.id,
      {
        displayName: displayName.trim(),
        notes,
        linkedUserId: linkedUserId === "none" ? null : linkedUserId,
      },
      currentUserId
    );
    setSubmitting(false);
    if (!result.ok) {
      toast({ title: "خطا", description: result.error, variant: "destructive" });
      return;
    }
    setOpen(false);
    toast({ title: "به‌روزرسانی شد", description: `«${cp.displayName}» ویرایش شد.` });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="ویرایش">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            ویرایش طرف حساب «{cp.displayName}»
          </DialogTitle>
          <DialogDescription>
            نام نمایشی، یادداشت و اتصال به کاربر را ویرایش کنید. تغییرات برای
            همه کاربرانِ این طرف حساب مشترک بلافاصله اعمال می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>نام</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>یادداشت</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label>لینک به کاربر</Label>
            <Select
              value={linkedUserId}
              onValueChange={setLinkedUserId}
              disabled={submitting}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون لینک (شخص عادی)</SelectItem>
                {linkableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.displayName} ({u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
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

function DeleteCounterpartyDialog({
  cp,
  txnCount,
}: {
  cp: import("@/lib/accounting/types").Counterparty;
  txnCount: number;
}) {
  const deleteCounterparty = useAccountingStore((s) => s.deleteCounterparty);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    if (!currentUserId) return;
    if (txnCount > 0) {
      toast({
        title: "حذف ممکن نیست",
        description: "این طرف حساب تراکنش ثبت‌شده دارد و قابل حذف نیست.",
        variant: "destructive",
      });
      setOpen(false);
      return;
    }
    await deleteCounterparty(cp.id, currentUserId);
    setOpen(false);
    toast({ title: "حذف شد", description: `«${cp.displayName}» حذف شد.` });
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
            حذف طرف حساب «{cp.displayName}»؟
          </AlertDialogTitle>
          <AlertDialogDescription>
            {txnCount > 0
              ? "این طرف حساب تراکنش ثبت‌شده دارد و قابل حذف نیست. ابتدا تراکنش‌ها را حذف کنید."
              : "این عملیات قابل بازگشت نیست. آیا مطمئن هستید؟"}
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

// ===========================================================================
// بخش دسترسی طرف‌حساب‌های مشترک (گرنت‌ها)
// ===========================================================================

function AccessGrantsSection() {
  const counterparties = useAccountingStore((s) => s.counterparties);
  const users = useAccountingStore((s) => s.users);
  const grants = useAccountingStore((s) => s.grants);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const grantCpAccess = useAccountingStore((s) => s.grantCpAccess);
  const revokeCpAccess = useAccountingStore((s) => s.revokeCpAccess);
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const sharedCps = counterparties.filter((c) => c.isShared && !c.archivedAt);

  function grantedUsersOf(cpId: string) {
    return grants
      .filter((g) => g.counterpartyId === cpId)
      .map((g) => users.find((u) => u.id === g.userId))
      .filter(Boolean) as Array<import("@/lib/accounting/types").User>;
  }

  async function handleGrant(
    cpId: string,
    userId: string
  ) {
    if (!currentUserId) return;
    const key = `${cpId}-${userId}`;
    setBusy(key);
    const res = await grantCpAccess(userId, cpId, currentUserId);
    setBusy(null);
    if (!res.ok) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "دسترسی داده شد",
      description: "این کاربر از حالا طرف‌حساب را در فرم ثبت تراکنش می‌بیند.",
    });
  }

  async function handleRevoke(
    cpId: string,
    userId: string,
    name: string
  ) {
    if (!currentUserId) return;
    const key = `${cpId}-${userId}`;
    setBusy(key);
    const res = await revokeCpAccess(userId, cpId, currentUserId);
    setBusy(null);
    if (!res.ok) {
      toast({ title: "خطا", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "دسترسی گرفته شد",
      description: `«${name}» دیگر این طرف‌حساب را در فرم ثبت نمی‌بیند.`,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          دسترسی طرف‌حساب‌های مشترک
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(grants.length.toString())} اجازه
          </Badge>
        </CardTitle>
        <CardDescription>
          مشخص کنید هر کاربر کدام طرف‌حساب‌های مشترک را در فرم ثبت تراکنشِ خود
          ببیند (مثلاً فائزه: وحید، رضا، علی و حمید). طرف‌حساب‌های شخصی هر
          کاربر فقط خودش را می‌بینند و به این بخش ربطی ندارند.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <ul className="divide-y">
            {sharedCps.map((c) => {
              const granted = grantedUsersOf(c.id);
              // قابل انتخاب: همه کاربران فعال به‌جز نماینده خود طرف‌حساب
              const candidates = users.filter(
                (u) =>
                  u.isActive !== false &&
                  u.id !== c.linkedUserId &&
                  !granted.some((g) => g.id === u.id)
              );
              return (
                <li key={c.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.displayName}</span>
                    {c.linkedUserId ? (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 px-1.5 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                      >
                        <Link2 className="h-2.5 w-2.5" />
                        {c.linkedUsername}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[10px]">
                        بدون پنل کاربری
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {granted.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        هیچ کاربری هنوز به این طرف‌حساب دسترسی ندارد
                      </span>
                    )}
                    {granted.map((u) => {
                      const key = `${c.id}-${u.id}`;
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 pl-2.5 pr-1 py-0.5 text-[11px] text-emerald-800 dark:text-emerald-300"
                        >
                          {u.displayName}
                          <button
                            type="button"
                            className="h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900 cursor-pointer"
                            title={`گرفتن دسترسی از ${u.displayName}`}
                            aria-label={`گرفتن دسترسی از ${u.displayName}`}
                            disabled={busy === key}
                            onClick={() => void handleRevoke(c.id, u.id, u.displayName)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                    {candidates.length > 0 && (
                      <Select
                        onValueChange={(v) => {
                          if (v) void handleGrant(c.id, v);
                        }}
                        value=""
                      >
                        <SelectTrigger
                          className="h-7 w-auto min-w-28 text-[11px] gap-1 cursor-pointer"
                          aria-label={`افزودن دسترسی به ${c.displayName}`}
                        >
                          <Plus className="h-3 w-3 text-emerald-600" />
                          <span className="text-muted-foreground">
                            افزودن کاربر…
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {candidates.map((u) => (
                            <SelectItem key={u.id} value={u.id} className="text-xs">
                              {u.displayName} ({u.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </li>
              );
            })}
            {sharedCps.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                هنوز طرف‌حساب مشترکی ساخته نشده است.
              </li>
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// بخش بک‌آپ — دستی (دانلود JSON) + خودکار (ارسال به ایمیل)
// ===========================================================================

function BackupSection() {
  const { toast } = useToast();
  const realMode = useAccountingStore((s) => s.realMode);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);
  const categories = useAccountingStore((s) => s.categories);
  const comments = useAccountingStore((s) => s.comments);
  const grants = useAccountingStore((s) => s.grants);
  const auditLogs = useAccountingStore((s) => s.auditLogs);

  const [emailSending, setEmailSending] = useState(false);

  // بک‌آپ دستی — دانلود JSON با متاداده
  function handleDownloadBackup() {
    if (!currentUserId) return;
    const now = new Date();
    const tehranStr = now.toLocaleString("en-US", { timeZone: "Asia/Tehran" });
    const backup = {
      meta: {
        version: APP_VERSION,
        generatedAt: now.toISOString(),
        generatedAtTehran: tehranStr,
        generatedBy: currentUserId,
        mode: realMode ? "production" : "sandbox-mock",
        rowCounts: {
          users: users.length,
          counterparties: counterparties.length,
          transactions: transactions.length,
          categories: categories.length,
          comments: comments.length,
          grants: grants.length,
          auditLogs: auditLogs.length,
        },
      },
      users: realMode ? users.map(({ password, ...rest }) => rest) : users,
      counterparties,
      transactions,
      categories,
      comments,
      grants,
      auditLogs,
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-dafter-${tehranStr.replace(/[/ :,]/g, "-")}-v${APP_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "بک‌آپ دانلود شد",
      description: `فایل JSON شامل ${toPersianDigits(transactions.length.toString())} تراکنش و ${toPersianDigits(users.length.toString())} کاربر دانلود شد.`,
    });
  }

  // بک‌آپ به ایمیل (فقط حالت واقعی) — فراخوانی EF backup-email
  async function handleEmailBackup() {
    if (!realMode) {
      toast({
        title: "غیرفعال در حالت موک",
        description: "بک‌آپ ایمیل فقط در حالت تولید (Supabase واقعی) کار می‌کند.",
        variant: "destructive",
      });
      return;
    }
    setEmailSending(true);
    try {
      const res = await triggerBackupEmailReal();
      if (res.emailSent) {
        toast({
          title: "بک‌آپ ارسال شد",
          description: `فایل بک‌آپ به ${res.recipient} ارسال شد — ${toPersianDigits(String(res.rowCounts?.transactions ?? 0))} تراکنش.`,
        });
      } else {
        toast({
          title: "بک‌آپ ساخته شد ولی ایمیل ارسال نشد",
          description: res.message ?? "متغیرهای ایمیل (RESEND_API_KEY و…) تنظیم نشده‌اند.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "خطا در بک‌آپ ایمیل",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    }
    setEmailSending(false);
  }

  const totalRows =
    users.length +
    counterparties.length +
    transactions.length +
    categories.length +
    comments.length +
    grants.length +
    auditLogs.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </span>
          بک‌آپ و بازیابی
          <Badge variant="secondary" className="ms-1 h-5">
            {toPersianDigits(totalRows.toString())} ردیف
          </Badge>
        </CardTitle>
        <CardDescription>
          بک‌آپ دستی به‌صورت فایل JSON با تاریخ، ساعت دقیقه و نسخه سامانه — یا
          بک‌آپ خودکار روزانه به ایمیل.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* خلاصه آماری */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-lg font-bold text-primary">
              {toPersianDigits(users.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">کاربر</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-lg font-bold text-primary">
              {toPersianDigits(transactions.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">تراکنش</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-lg font-bold text-primary">
              {toPersianDigits(counterparties.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">طرف‌حساب</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-lg font-bold text-primary">
              {toPersianDigits(auditLogs.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">گزارش ممیزی</div>
          </div>
        </div>

        {/* دکمه‌های بک‌آپ دستی و ایمیل */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            onClick={handleDownloadBackup}
            className="h-11"
            disabled={!currentUserId}
          >
            <Download className="h-4 w-4 ml-2" />
            دانلود بک‌آپ JSON
          </Button>
          <Button
            onClick={handleEmailBackup}
            variant="outline"
            className="h-11"
            disabled={emailSending || !realMode}
            title={!realMode ? "فقط در حالت تولید (Supabase واقعی) فعال است" : undefined}
          >
            {emailSending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 ml-2" />
            )}
            ارسال بک‌آپ به ایمیل
          </Button>
        </div>

        {/* اطلاعات بک‌آپ خودکار */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-primary mb-1.5">
            <Clock className="h-3.5 w-3.5" />
            بک‌آپ خودکار روزانه
          </div>
          <p className="text-muted-foreground">
            برای فعال‌سازی بک‌آپ خودکار روزانه به ایمیل، در Supabase:
          </p>
          <ol className="mt-2 space-y-1 text-muted-foreground list-decimal pe-4">
            <li>
              حساب رایگان <span dir="ltr" className="font-mono">resend.com</span> بسازید و API Key بگیرید
            </li>
            <li>
              در Supabase Project Settings → Edge Functions Secrets این متغیرها را set کنید:
              <div dir="ltr" className="mt-1 rounded-md bg-muted p-2 font-mono text-[10px]">
                RESEND_API_KEY=re_xxxx<br />
                BACKUP_EMAIL_FROM=backup@yourdomain.com<br />
                BACKUP_EMAIL_TO=you@example.com<br />
                BACKUP_WEBHOOK_SECRET=random_secret_string
              </div>
            </li>
            <li>
              Edge Function <span dir="ltr" className="font-mono">backup-email</span> را deploy کنید
            </li>
            <li>
              در SQL Editor این افزونه‌ها و زمان‌بندی را اجرا کنید (هر روز ۰۲:۰۰ به وقت تهران):
              <div dir="ltr" className="mt-1 rounded-md bg-muted p-2 font-mono text-[10px] overflow-x-auto">
                create extension if not exists pg_cron;<br />
                create extension if not exists pg_net;<br />
                select cron.schedule(<br />
                &nbsp;&nbsp;'daily-backup-email',<br />
                &nbsp;&nbsp;'30 22 * * *',<br />
                &nbsp;&nbsp;$$select net.http_post(<br />
                &nbsp;&nbsp;&nbsp;&nbsp;url := 'https://YOUR_PROJECT.functions.supabase.co/backup-email',<br />
                &nbsp;&nbsp;&nbsp;&nbsp;headers := jsonb_build_object('Content-Type','application/json','X-Backup-Secret','YOUR_SECRET'),<br />
                &nbsp;&nbsp;&nbsp;&nbsp;body := jsonb_build_object('scheduled',true)::text<br />
                &nbsp;&nbsp;)$$<br />
                );
              </div>
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// بخش اکسل — بارگذاری (template + import) و خروجی (export)
// ===========================================================================

function ExcelImportExportSection() {
  const { toast } = useToast();
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);
  const categories = useAccountingStore((s) => s.categories);
  const addTransaction = useAccountingStore((s) => s.addTransaction);

  // شیت راهنمای فرمت اکسل برای ورود
  function handleDownloadTemplate() {
    const wb = XLSX.utils.book_new();
    // شیت ۱: راهنما
    const guideRows = [
      ["ستون", "نوع", "الزامی؟", "توضیحات"],
      ["نوع عملیات (kind)", "متن", "بله", "یکی از: opening_claim, opening_debt, claim, debt, paid_to, received_from"],
      ["نام طرف حساب", "متن", "بله", "نام طرف حساب (باید در دفتر شما موجود باشد)"],
      ["مبلغ (تومان)", "عدد", "بله", "عدد صحیح مثبت — مثلاً 1000000"],
      ["واحد", "متن", "خیر", "IRT (تومان) یا IRR (ریال) — پیش‌فرض IRT"],
      ["تاریخ شمسی", "متن", "بله", "فرمت yyyy-mm-dd — مثلاً 1405-08-20"],
      ["توضیحات", "متن", "خیر", "مثلاً: پرداخت قسط اول"],
      ["نام دسته", "متن", "خیر", "نام دسته شخصی شما — اگر خالی باشد، بدون دسته ثبت می‌شود"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(guideRows);
    ws1["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws1, "راهنما");

    // شیت ۲: نمونه با یک ردیف خالی
    const sampleRows = [
      ["نوع عملیات (kind)", "نام طرف حساب", "مبلغ (تومان)", "واحد", "تاریخ شمسی", "توضیحات", "نام دسته"],
      ["paid_to", "فائزه", 1000000, "IRT", "1405-08-20", "پرداخت قسط اول", "قسط"],
      ["claim", "رضا کریمی", 500000, "IRT", "1405-08-21", "", ""],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(sampleRows);
    ws2["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "ورود تراکنش‌ها");

    XLSX.writeFile(wb, `template-dafter-v${APP_VERSION}.xlsx`);
    toast({
      title: "فایل الگو دانلود شد",
      description: "شیت «ورود تراکنش‌ها» را با داده‌های خود پر کنید و دوباره بارگذاری کنید.",
    });
  }

  // خروجی اکسل همه تراکنش‌ها — گروه‌بندی به ترتیب: کاربر → طرف حساب → دسته
  function handleExportTransactions() {
    if (transactions.length === 0) {
      toast({
        title: "تراکنشی نیست",
        description: "هنوز تراکنشی ثبت نشده است.",
        variant: "destructive",
      });
      return;
    }

    const wb = XLSX.utils.book_new();

    // شیت ۱: خلاصه کلی
    const summaryRows: any[][] = [
      ["خلاصه خروجی تراکنش‌ها", ""],
      ["نسخه سامانه", APP_VERSION],
      ["زمان تولید", new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" })],
      ["تعداد کل تراکنش‌ها", transactions.length],
      ["تعداد کاربران", users.length],
      ["تعداد طرف‌حساب‌ها", counterparties.length],
      ["تعداد دسته‌ها", categories.length],
      ["", ""],
      ["توزیع بر اساس نوع عملیات", ""],
    ];
    const kindCounts: Record<string, number> = {};
    for (const t of transactions) {
      kindCounts[t.kind] = (kindCounts[t.kind] ?? 0) + 1;
    }
    for (const k of Object.keys(kindCounts)) {
      summaryRows.push([KIND_LABELS[k as keyof typeof KIND_LABELS] ?? k, kindCounts[k]]);
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "خلاصه");

    // مرتب‌سازی: کاربر → طرف حساب → دسته → تاریخ (نزولی)
    const sorted = [...transactions].sort((a, b) => {
      const uA = users.find((u) => u.id === a.userId)?.displayName ?? "—";
      const uB = users.find((u) => u.id === b.userId)?.displayName ?? "—";
      if (uA !== uB) return uA.localeCompare(uB, "fa");
      const cA = counterparties.find((c) => c.id === a.counterpartyId)?.displayName ?? "—";
      const cB = counterparties.find((c) => c.id === b.counterpartyId)?.displayName ?? "—";
      if (cA !== cB) return cA.localeCompare(cB, "fa");
      const catA = categories.find((c) => c.id === a.categoryId)?.name ?? "—";
      const catB = categories.find((c) => c.id === b.categoryId)?.name ?? "—";
      if (catA !== catB) return catA.localeCompare(catB, "fa");
      return b.effectiveAt.localeCompare(a.effectiveAt);
    });

    // شیت ۲: همه تراکنش‌ها (flat) — برای فیلتر Pivot در اکسل
    const flatRows: any[][] = [[
      "کاربر", "نام کاربری کاربر", "نوع عملیات", "برچسب نوع", "طرف حساب",
      "نوع طرف حساب", "لینک به کاربر", "مبلغ (تومان)", "واحد", "تاریخ شمسی",
      "زمان ثبت", "دسته", "نوع دسته (عمومی/مخصوص)", "توضیحات", "وضعیت",
    ]];
    for (const t of sorted) {
      const u = users.find((x) => x.id === t.userId);
      const cp = counterparties.find((x) => x.id === t.counterpartyId);
      const cat = categories.find((x) => x.id === t.categoryId);
      const linkedU = cp?.linkedUserId ? users.find((x) => x.id === cp.linkedUserId) : null;
      flatRows.push([
        u?.displayName ?? "—",
        u?.username ?? "—",
        t.kind,
        KIND_LABELS[t.kind] ?? t.kind,
        cp?.displayName ?? "—",
        cp?.isShared ? "مشترک" : "شخصی",
        linkedU?.username ?? "",
        t.amount,
        t.currency,
        t.effectiveAt,
        t.createdAt,
        cat?.name ?? "",
        cat ? (cat.counterpartyId ? "مخصوص" : "عمومی") : "",
        t.description ?? "",
        t.status,
      ]);
    }
    const wsFlat = XLSX.utils.aoa_to_sheet(flatRows);
    wsFlat["!cols"] = [
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 },
      { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsFlat, "همه تراکنش‌ها");

    // شیت ۳ به بعد: به تفکیک هر کاربر
    const byUser = new Map<string, Transaction[]>();
    for (const t of sorted) {
      const arr = byUser.get(t.userId) ?? [];
      arr.push(t);
      byUser.set(t.userId, arr);
    }
    let sheetIdx = 1;
    for (const [userId, txns] of byUser) {
      const u = users.find((x) => x.id === userId);
      const safeName = (u?.displayName ?? `user-${sheetIdx}`)
        .replace(/[\\/?*[\]:]/g, "")
        .slice(0, 28);
      const rows: any[][] = [[
        "نوع عملیات", "طرف حساب", "مبلغ", "واحد", "تاریخ شمسی", "دسته", "توضیحات",
      ]];
      // گروه‌بندی به ترتیب: طرف حساب → دسته
      const byCp = new Map<string, Transaction[]>();
      for (const t of txns) {
        const arr = byCp.get(t.counterpartyId) ?? [];
        arr.push(t);
        byCp.set(t.counterpartyId, arr);
      }
      for (const [cpId, cpTxns] of byCp) {
        const cp = counterparties.find((x) => x.id === cpId);
        // زیرگروه دسته
        const byCat = new Map<string | null, Transaction[]>();
        for (const t of cpTxns) {
          const key = t.categoryId ?? null;
          const arr = byCat.get(key) ?? [];
          arr.push(t);
          byCat.set(key, arr);
        }
        for (const [catId, catTxns] of byCat) {
          const cat = catId ? categories.find((x) => x.id === catId) : null;
          for (const t of catTxns) {
            rows.push([
              KIND_LABELS[t.kind] ?? t.kind,
              cp?.displayName ?? "—",
              t.amount,
              t.currency,
              t.effectiveAt,
              cat?.name ?? "(بدون دسته)",
              t.description ?? "",
            ]);
          }
        }
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, `${safeName.slice(0, 26)}`);
      sheetIdx++;
    }

    const tehranStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" });
    XLSX.writeFile(wb, `transactions-dafter-${tehranStr.replace(/[/ :,]/g, "-")}.xlsx`);
    toast({
      title: "خروجی اکسل ساخته شد",
      description: `${toPersianDigits(transactions.length.toString())} تراکنش در ${toPersianDigits(String(byUser.size + 2))} شیت (خلاصه + همه + به تفکیک کاربر).`,
    });
  }

  // ورود از اکسل — parse + ساخت تراکنش برای هر ردیف
  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentUserId) {
      toast({ title: "خطا", description: "احراز هویت نشده.", variant: "destructive" });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // شیت «ورود تراکنش‌ها» را پیدا کن — اگر نبود، اولین شیت غیر از «راهنما»
      const sheetName =
        wb.SheetNames.find((n) => n.includes("ورود")) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        toast({ title: "خطا", description: "شیت ورود پیدا نشد.", variant: "destructive" });
        return;
      }
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) {
        toast({ title: "خطا", description: "هیچ ردیف داده‌ای نیست.", variant: "destructive" });
        return;
      }
      // ردیف اول = هدر
      const header = rows[0].map((h) => String(h ?? "").trim());
      const findCol = (variants: string[]) =>
        header.findIndex((h) =>
          variants.some((v) => h.includes(v) || h.toLowerCase().includes(v.toLowerCase()))
        );
      const colKind = findCol(["نوع عملیات", "kind"]);
      const colCp = findCol(["نام طرف حساب", "طرف حساب", "counterparty"]);
      const colAmount = findCol(["مبلغ", "amount"]);
      const colCurrency = findCol(["واحد", "currency"]);
      const colDate = findCol(["تاریخ شمسی", "تاریخ", "effectiveAt", "date"]);
      const colDesc = findCol(["توضیحات", "description", "desc"]);
      const colCat = findCol(["نام دسته", "دسته", "category"]);

      if (colKind < 0 || colCp < 0 || colAmount < 0 || colDate < 0) {
        toast({
          title: "ستون‌های لازم پیدا نشد",
          description: "حداقل ستون‌های «نوع عملیات»، «نام طرف حساب»، «مبلغ» و «تاریخ شمسی» لازم است. از فایل الگو استفاده کنید.",
          variant: "destructive",
        });
        return;
      }

      const state = useAccountingStore.getState();
      const myCps = state.counterparties.filter((c) => {
        if (c.archivedAt) return false;
        if (c.linkedUserId === currentUserId) return false;
        if (!c.isShared) return c.ownerUserId === currentUserId;
        const me = state.users.find((u) => u.id === currentUserId);
        if (me?.role === "admin") return true;
        return state.grants.some((g) => g.userId === currentUserId && g.counterpartyId === c.id);
      });
      const myCats = state.categories.filter((c) => c.userId === currentUserId);

      let success = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;
        const kind = String(r[colKind] ?? "").trim();
        const cpName = String(r[colCp] ?? "").trim();
        const amountRaw = r[colAmount];
        const currency = colCurrency >= 0 ? String(r[colCurrency] ?? "").trim() || "IRT" : "IRT";
        const effectiveAt = String(r[colDate] ?? "").trim();
        const description = colDesc >= 0 ? String(r[colDesc] ?? "").trim() : "";
        const catName = colCat >= 0 ? String(r[colCat] ?? "").trim() : "";

        if (!kind || !cpName || !amountRaw) {
          skipped++;
          continue;
        }
        // نرمال‌سازی مبلغ
        const amount = Math.floor(Number(String(amountRaw).replace(/[^\d.-]/g, "")));
        if (!Number.isFinite(amount) || amount <= 0) {
          errors.push(`ردیف ${i + 1}: مبلغ نامعتبر «${amountRaw}»`);
          skipped++;
          continue;
        }
        // یافتن طرف حساب
        const cp = myCps.find((c) => c.displayName.trim() === cpName);
        if (!cp) {
          errors.push(`ردیف ${i + 1}: طرف حساب «${cpName}» پیدا نشد`);
          skipped++;
          continue;
        }
        // یافتن دسته (اختیاری)
        let categoryId: string | null = null;
        if (catName) {
          const cat = myCats.find((c) => c.name === catName);
          if (!cat) {
            errors.push(`ردیف ${i + 1}: دسته «${catName}» پیدا نشد`);
            skipped++;
            continue;
          }
          // دسته مخصوص باید با این طرف حساب منطبق باشد
          if (cat.counterpartyId && cat.counterpartyId !== cp.id) {
            errors.push(`ردیف ${i + 1}: دسته «${catName}» مخصوص طرف‌حساب دیگری است`);
            skipped++;
            continue;
          }
          categoryId = cat.id;
        }
        // اعتبارسنجی kind
        const VALID_KINDS = ["opening_claim", "opening_debt", "claim", "debt", "paid_to", "received_from"];
        if (!VALID_KINDS.includes(kind)) {
          errors.push(`ردیف ${i + 1}: نوع «${kind}» نامعتبر`);
          skipped++;
          continue;
        }

        const res = await addTransaction(
          {
            kind: kind as any,
            counterpartyId: cp.id,
            amount,
            currency: currency === "IRR" ? "IRR" : "IRT",
            effectiveAt,
            description: description || undefined,
            categoryId,
          },
          currentUserId
        );
        if (res.ok) success++;
        else {
          errors.push(`ردیف ${i + 1}: ${res.error}`);
          skipped++;
        }
      }

      const summary =
        `${toPersianDigits(success.toString())} تراکنش ثبت شد` +
        (skipped > 0 ? `، ${toPersianDigits(skipped.toString())} ردیف رد شد` : "");
      toast({
        title: "ورود کامل شد",
        description: errors.length > 0
          ? `${summary} — اولین خطاها: ${errors.slice(0, 2).join("؛ ")}`
          : summary,
        variant: errors.length > 0 ? "destructive" : "default",
      });
    } catch (err) {
      toast({
        title: "خطا در خواندن فایل",
        description: err instanceof Error ? err.message : "خطای ناشناخته",
        variant: "destructive",
      });
    }
    // پاک کردن input برای allow re-upload همان فایل
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          بارگذاری و خروجی اکسل
        </CardTitle>
        <CardDescription>
          فایل الگوی اکسل را دانلود کنید، با فرمت درست پر کنید و دوباره بارگذاری کنید —
          یا تمام تراکنش‌ها را به تفکیک کاربر، طرف حساب و دسته به اکسل خروجی بگیرید.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* خلاصه آماری */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-base font-bold text-primary">
              {toPersianDigits(transactions.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">تراکنش</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-base font-bold text-primary">
              {toPersianDigits(users.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">کاربر</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2.5 text-center">
            <div className="text-base font-bold text-primary">
              {toPersianDigits(categories.length.toString())}
            </div>
            <div className="text-[10px] text-muted-foreground">دسته</div>
          </div>
        </div>

        {/* دکمه دانلود الگو و ورود */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">
            ورود (Import) تراکنش‌ها
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={handleDownloadTemplate} variant="outline" className="h-11">
              <Download className="h-4 w-4 ml-2" />
              دانلود فایل الگو (Excel)
            </Button>
            <label className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-md border border-input bg-background px-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <Upload className="h-4 w-4" />
              بارگذاری فایل پرشده
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* دکمه خروجی */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">
            خروجی (Export) تراکنش‌ها
          </div>
          <Button onClick={handleExportTransactions} className="h-11 w-full">
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            خروجی اکسل همه تراکنش‌ها
            <span className="text-xs opacity-80 mr-2">
              (خلاصه + همه + به تفکیک کاربر)
            </span>
          </Button>
        </div>

        {/* راهنما */}
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/15 dark:text-amber-300">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <Filter className="h-3.5 w-3.5" />
            نکته
          </div>
          فایل خروجی شامل سه نوع شیت است:
          <ol className="mt-1 space-y-0.5 list-decimal pe-4">
            <li><b>خلاصه</b> — آمار کلی + توزیع نوع عملیات</li>
            <li><b>همه تراکنش‌ها</b> — جدول کامل با همه ستون‌ها (مناسب Pivot)</li>
            <li><b>به تفکیک کاربر</b> — یک شیت برای هر کاربر، گروه‌بندی طرف حساب → دسته</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
