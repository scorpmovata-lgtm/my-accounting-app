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
} from "@/components/ui/alert-dialog";
import {
  adminBackup,
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminRestore,
} from "@/lib/supabase/api";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast";
import { formatJalaliShort, toPersianDigits } from "@/lib/accounting/jalali";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  display_name: string | null;
}

export function AdminTab() {
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // فرم ساخت کاربر
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  // backup/restore
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<{ data: unknown; filename: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } catch (e) {
      toast({
        title: "خطا در بارگذاری کاربران",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCreateUser() {
    if (!newEmail.trim() || !newPassword) {
      toast({
        title: "خطا",
        description: "ایمیل و رمز را وارد کنید.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "خطا",
        description: "رمز باید حداقل ۶ کاراکتر باشد.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const user = await adminCreateUser({
        email: newEmail.trim(),
        password: newPassword,
        display_name: newDisplayName.trim() || undefined,
      });
      toast({
        title: "کاربر ساخته شد",
        description: `${user.email} (${user.display_name})`,
      });
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setShowCreateDialog(false);
      await loadUsers();
    } catch (e) {
      toast({
        title: "خطا در ساخت کاربر",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setDeleting(true);
    try {
      await adminDeleteUser(deleteUserId);
      toast({
        title: "کاربر حذف شد",
        description: "کاربر با موفقیت حذف شد.",
      });
      setDeleteUserId(null);
      await loadUsers();
    } catch (e) {
      toast({
        title: "خطا در حذف کاربر",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const data = await adminBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `accounting-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "بک‌آپ ایجاد شد",
        description: "فایل JSON دانلود شد.",
      });
    } catch (e) {
      toast({
        title: "خطا در بک‌آپ",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setBackingUp(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.ledgers) {
          toast({
            title: "خطا",
            description: "فایل بک‌آپ معتبر نیست (فیلد ledgers پیدا نشد).",
            variant: "destructive",
          });
          return;
        }
        setRestoreConfirm({ data, filename: file.name });
      } catch (err) {
        toast({
          title: "خطا",
          description: "فایل JSON معتبر نیست.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    // reset input
    e.target.value = "";
  }

  async function handleRestore() {
    if (!restoreConfirm) return;
    setRestoring(true);
    try {
      const result = await adminRestore(restoreConfirm.data);
      toast({
        title: "بازگردانی شد",
        description: `آمار: ${Object.entries(result.stats)
          .map(([k, v]) => `${translateStatKey(k)}: ${toPersianDigits(v as number)}`)
          .join("، ")}`,
      });
      setRestoreConfirm(null);
      // refresh data
      await refresh();
    } catch (e) {
      toast({
        title: "خطا در بازگردانی",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* معرفی */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <div className="font-medium">پنل مدیریت (ادمین)</div>
              <p className="text-muted-foreground leading-relaxed">
                {authUser
                  ? `به‌عنوان ادمین (${authUser.displayName ?? authUser.email}) وارد شده‌ای.`
                  : "این بخش فقط برای ادمین قابل دسترس است."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مدیریت کاربران */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            مدیریت کاربران
            <Badge variant="secondary" className="mr-auto">
              {toPersianDigits(users.length)} کاربر
            </Badge>
            <Button
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <UserPlus className="h-4 w-4 ml-1" />
              کاربر جدید
            </Button>
          </CardTitle>
          <CardDescription>
            کاربرانی که می‌توانند وارد اپ شوند. هر کاربر می‌تواند با email + password
            که تو تعیین می‌کنی وارد شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              هیچ کاربری ثبت نشده. دکمه «کاربر جدید» را بزن.
            </div>
          ) : (
            <ScrollArea className="h-72">
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span className="truncate">{u.display_name ?? u.email}</span>
                        {u.id === authUser?.id && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                            تو
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" dir="ltr">
                        {u.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>ساخته‌شده: {formatJalaliShort(u.created_at)}</span>
                        {u.email_confirmed ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                            تأیید شده
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                            تأیید نشده
                          </Badge>
                        )}
                      </div>
                    </div>
                    {u.id !== authUser?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteUserId(u.id)}
                        className="text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* بک‌آپ و بازگردانی */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            بک‌آپ و بازگردانی
          </CardTitle>
          <CardDescription>
            کل داده‌های دفتر خودت را به فایل JSON export کن (شامل: تراکنش‌ها،
            طرف حساب‌ها، سرفصل‌ها، اتصال‌های تلگرام، ممیزی).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackup} disabled={backingUp}>
              {backingUp ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  در حال بک‌آپ...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 ml-1" />
                  دریافت بک‌آپ
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  در حال بازگردانی...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 ml-1" />
                  بازگردانی از فایل
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>توجه:</strong> بازگردانی رکوردهای موجود را با همان ID
                جایگزین می‌کند (upsert) ولی رکوردهایی که در فایل نیستند را پاک
                نمی‌کند. برای پاک‌سازی کامل، ابتدا در Supabase → Table Editor
                رکوردها را پاک کن، سپس restore کن.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* دیالوگ ساخت کاربر */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>کاربر جدید</AlertDialogTitle>
            <AlertDialogDescription>
              یک کاربر جدید بساز. این کاربر می‌تواند با email + password وارد شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-email">ایمیل</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">رمز</Label>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-display-name">نام نمایشی (اختیاری)</Label>
              <Input
                id="new-display-name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="مثلاً: محمد قاسمی"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  در حال ساخت...
                </>
              ) : (
                "ساخت کاربر"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* دیالوگ تأیید حذف کاربر */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(o) => !o && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف کاربر</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئنی؟ این کار قابل بازگشت نیست. همه داده‌های مربوط به این کاربر
              (دفتر، تراکنش‌ها، طرف حساب‌ها) حذف خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  در حال حذف...
                </>
              ) : (
                "حذف"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* دیالوگ تأیید بازگردانی */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={(o) => !o && setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بازگردانی داده‌ها</AlertDialogTitle>
            <AlertDialogDescription>
              فایل <code className="text-foreground">{restoreConfirm?.filename}</code> انتخاب شده.
              این کار داده‌های موجود را با داده‌های فایل جایگزین می‌کند. ادامه می‌دهی؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  در حال بازگردانی...
                </>
              ) : (
                "بازگردانی کن"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function translateStatKey(key: string): string {
  switch (key) {
    case "contacts": return "طرف حساب";
    case "categories": return "سرفصل";
    case "transactions": return "تراکنش";
    case "telegram_links": return "اتصال تلگرام";
    case "link_codes": return "کد اتصال";
    default: return key;
  }
}
