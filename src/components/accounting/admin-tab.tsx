"use client";

import { useState } from "react";
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
  type UserScope,
  type UserRole,
} from "@/lib/accounting/types";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { AdminTelegramSection } from "./admin-telegram-section";

export function AdminTab() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3 flex items-start gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-800 dark:text-emerald-300">
          پنل مدیریت سامانه — کاربران، دسترسی طرف‌حساب‌های مشترک، فعال/غیرفعال‌سازی
          و ربات تلگرام. هر کاربر در دفتر مستقل خودش ثبت می‌کند و دیگرانِ لینک‌شده
          رکوردهای او را می‌بینند.
        </div>
      </div>
      <UsersSection />
      <AdminTelegramSection />
      <AccessGrantsSection />
      <CounterpartiesSection />
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
                        <Badge className="h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
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
    await deleteUser(user.id, currentUserId);
    setOpen(false);
    toast({
      title: "کاربر حذف شد",
      description: `«${user.displayName}» حذف شد.`,
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
