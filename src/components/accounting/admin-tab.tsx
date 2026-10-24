"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users,
  Download,
  Upload,
  Trash2,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  adminListUsers,
  adminCreateUser,
  adminDeleteUser,
  adminBackup,
  adminRestore,
  AdminUser,
  BackupData,
} from "@/lib/supabase/api";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast";
import { formatJalaliShort, toPersianDigits } from "@/lib/accounting/jalali";

export function AdminTab() {
  const authUser = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);

  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // فرم ساخت کاربر جدید
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // پشتیبان‌گیری
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser() {
    setCreatingUser(true);
    try {
      const result = await adminCreateUser({
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim() || newEmail.trim(),
      });
      if (result.ok) {
        toast({
          title: "کاربر ساخته شد",
          description: `حساب ${newEmail.trim()} ایجاد شد.`,
        });
        setNewEmail("");
        setNewPassword("");
        setNewDisplayName("");
        await loadUsers();
      } else {
        toast({
          title: "خطا در ساخت کاربر",
          description: result.error ?? "خطای ناشناخته",
          variant: "destructive",
        });
      }
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleDeleteUser(userId: string, email: string | null) {
    const ok = await adminDeleteUser(userId);
    if (ok) {
      toast({
        title: "کاربر حذف شد",
        description: email
          ? `حساب ${email} حذف شد.`
          : "کاربر حذف شد.",
      });
      await loadUsers();
    } else {
      toast({
        title: "خطا در حذف کاربر",
        description: "عملیات ناموفق بود. ممکن است ادمین نباشید یا اتصال قطع شده باشد.",
        variant: "destructive",
      });
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const data = await adminBackup();
      if (!data) {
        toast({
          title: "خطا در پشتیبان‌گیری",
          description: "دریافت داده ناموفق بود.",
          variant: "destructive",
        });
        return;
      }
      // دانلود به‌عنوان JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = formatJalaliShort(new Date()).replace(/\//g, "-");
      a.download = `accounting-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "پشتیبان‌گیری انجام شد",
        description: `فایل دانلود شد — ${toPersianDigits(
          (data.transactions ?? []).length
        )} تراکنش.`,
      });
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestoreFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.ledgers) {
          toast({
            title: "فایل نامعتبر",
            description: "این فایل backup معتبر نیست (فیلد ledgers موجود نیست).",
            variant: "destructive",
          });
          return;
        }
        setPendingRestore(parsed as BackupData);
      } catch {
        toast({
          title: "خطا در خواندن فایل",
          description: "فایل JSON معتبر نیست.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  }

  async function handleRestoreConfirm() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      const result = await adminRestore(pendingRestore);
      if (result.ok) {
        toast({
          title: "بازگردانی انجام شد",
          description: "داده‌ها از فایل backup بازیابی شد.",
        });
        await refresh();
      } else {
        toast({
          title: "خطا در بازگردانی",
          description: result.error ?? "خطای ناشناخته",
          variant: "destructive",
        });
      }
    } finally {
      setRestoring(false);
      setPendingRestore(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* هشدار ادمین */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-medium text-amber-800 dark:text-amber-300">
                پنل مدیریت (ادمین)
              </div>
              <p className="text-muted-foreground leading-relaxed">
                شما به‌عنوان صاحب دفتر به این پنل دسترسی دارید. اینجا می‌توانید
                کاربران جدید بسازید، کاربران را حذف کنید، و از داده‌ها پشتیبان
                بگیرید یا بازگردانی کنید.
                {authUser?.displayName && (
                  <>
                    {" "}— کاربر فعال:{" "}
                    <span className="font-medium">{authUser.displayName}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مدیریت کاربران */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Users className="h-5 w-5" />
            مدیریت کاربران
            <Badge variant="secondary" className="mr-auto">
              {toPersianDigits(users.length)} کاربر
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUsers}
              disabled={loadingUsers}
            >
              {loadingUsers ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              به‌روزرسانی
            </Button>
          </CardTitle>
          <CardDescription>
            ساخت حساب جدید برای اعضای دفتر و حذف حساب‌های غیرفعال.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* فهرست کاربران */}
          <ScrollArea className="h-[280px] rounded-md border">
            {users.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                کاربری یافت نشد.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {u.displayName ?? "بدون نام"}
                      </div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {u.email ?? "—"} •{" "}
                        {u.emailConfirmed ? "تأیید ایمیل ✓" : "بدون تأیید ایمیل"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        عضو از {formatJalaliShort(u.createdAt)}
                        {u.lastSignInAt && (
                          <> • آخرین ورود: {formatJalaliShort(u.lastSignInAt)}</>
                        )}
                        {u.id === authUser?.id && (
                          <Badge variant="secondary" className="mr-2 ml-1">
                            شما
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={u.id === authUser?.id}
                            title={
                              u.id === authUser?.id
                                ? "نمی‌توانید خودتان را حذف کنید"
                                : "حذف کاربر"
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف کاربر</AlertDialogTitle>
                            <AlertDialogDescription>
                              آیا مطمئنید می‌خواهید حساب{" "}
                              <span dir="ltr" className="font-medium">
                                {u.email ?? "بدون ایمیل"}
                              </span>{" "}
                              را حذف کنید؟ این عملیات غیرقابل بازگشت است و تمام
                              داده‌های مرتبط (دفتر، تراکنش‌ها) نیز پاک می‌شود.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>انصراف</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                            >
                              بله، حذف کن
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          {/* فرم ساخت کاربر */}
          <div className="rounded-md border p-3 bg-muted/20 space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              ساخت کاربر جدید
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="new-email" className="text-xs">
                  ایمیل
                </Label>
                <Input
                  id="new-email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-pass" className="text-xs">
                  رمز عبور (حداقل ۶ کاراکتر)
                </Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-name" className="text-xs">
                  نام نمایشی
                </Label>
                <Input
                  id="new-name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="مثلاً: علی رضایی"
                />
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={
                    creatingUser ||
                    !newEmail.trim() ||
                    !newPassword ||
                    newPassword.length < 6
                  }
                >
                  {creatingUser ? (
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 ml-1" />
                  )}
                  ساخت کاربر
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأیید ساخت کاربر</AlertDialogTitle>
                  <AlertDialogDescription>
                    کاربر جدید با ایمیل{" "}
                    <span dir="ltr" className="font-medium">
                      {newEmail}
                    </span>{" "}
                    ساخته می‌شود. رمز به‌صورت تأییدشده ثبت می‌شود و کاربر می‌تواند
                    بلافاصله وارد شود.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCreateUser}>
                    بله، بساز
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* پشتیبان‌گیری و بازگردانی */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            پشتیبان‌گیری و بازگردانی
          </CardTitle>
          <CardDescription>
            از تمام داده‌های دفتر (دفترها، مخاطبین، سرفصل‌ها، تراکنش‌ها،
            اتصال‌های تلگرام) به‌صورت یک فایل JSON پشتیبان بگیرید یا داده‌های
            قبلی را بازگردانی کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleBackup}
              disabled={backingUp}
              className="h-auto py-3 justify-start"
            >
              {backingUp ? (
                <Loader2 className="h-5 w-5 ml-2 animate-spin shrink-0" />
              ) : (
                <Download className="h-5 w-5 ml-2 shrink-0" />
              )}
              <div className="flex flex-col items-start text-right">
                <span className="font-medium">دانلود فایل پشتیبان</span>
                <span className="text-xs text-muted-foreground font-normal">
                  export کامل به‌صورت JSON
                </span>
              </div>
            </Button>

            <div className="contents">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleRestoreFile(f);
                  // reset input value تا فایل یکسان دوباره قابل انتخاب باشد
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={restoring}
                className="h-auto py-3 justify-start"
              >
                <Upload className="h-5 w-5 ml-2 shrink-0" />
                <div className="flex flex-col items-start text-right">
                  <span className="font-medium">بازگردانی از فایل</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    انتخاب فایل JSON قبلی
                  </span>
                </div>
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              بازگردانی رکوردهای موجود را با همان ID جایگزین می‌کند (upsert) ولی
              رکوردهایی که در فایل نیستند را پاک نمی‌کند. این عملیات در audit logs
              ثبت می‌شود.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* دیالوگ تأیید بازگردانی */}
      <AlertDialog
        open={!!pendingRestore}
        onOpenChange={(o) => {
          if (!o) setPendingRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأیید بازگردانی</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRestore && (
                <>
                  این فایل شامل:{" "}
                  {toPersianDigits((pendingRestore.transactions ?? []).length)}{" "}
                  تراکنش،{" "}
                  {toPersianDigits((pendingRestore.contacts ?? []).length)}{" "}
                  مخاطب،{" "}
                  {toPersianDigits((pendingRestore.categories ?? []).length)}{" "}
                  سرفصل است. تاریخ پشتیبان:{" "}
                  {formatJalaliShort(pendingRestore.created_at ?? new Date().toISOString())}.
                  ادامه می‌دهید؟
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={restoring}
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-1" />
              )}
              بله، بازگردانی کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
