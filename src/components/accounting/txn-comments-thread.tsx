"use client";

// رشته کامنت‌های یک تراکنش (دوطرفه) + فرم افزودن — نسخه ۳.۰
// -------------------------------------------------------------------
// چیدمان چت دوطرفه در RTL:
//   - کامنت‌های «خودم» سمت چپ (justify-end) با حباب سبز ملایم
//   - کامنت‌های دیگران سمت راست (justify-start) با حباب خنثی
// داده‌ها از استور خوانده می‌شود و با سابسکرایبِ `comments` ری‌اکتیو است.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  selectCommentsForTxn,
  useAccountingStore,
} from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, toPersianDigits } from "@/lib/accounting/jalali";

/** حرف اول نام برای آواتار دایره‌ای */
function nameLetter(name: string): string {
  return name.trim().charAt(0) || "؟";
}

/** زمان خوانا: نسبی برای نیم‌روز اخیر، وگرنه تاریخ + ساعت شمسی */
function friendlyTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return "چند لحظه پیش";
  if (minutes < 60) return `${toPersianDigits(String(minutes))} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 12) return `${toPersianDigits(String(hours))} ساعت پیش`;
  return formatDateTime(iso);
}

export function TxnCommentsThread({
  transactionId,
}: {
  transactionId: string;
}) {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const addComment = useAccountingStore((s) => s.addComment);
  const { toast } = useToast();

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // سابسکرایب `comments` برای ری‌اکتیو بودن رشته هنگام افزودن کامنت جدید
  const comments = useAccountingStore((s) => s.comments);

  const list = useMemo(
    () =>
      currentUserId
        ? selectCommentsForTxn(
            useAccountingStore.getState(),
            currentUserId,
            transactionId
          )
        : [],
    [comments, currentUserId, transactionId]
  );

  // اسکرول به آخرین کامنت (بار اول و بعد از هر افزودن)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [list.length, transactionId]);

  async function submit(): Promise<void> {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await addComment(transactionId, text);
    setSending(false);
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "ثبت کامنت ناموفق بود",
        description: res.error ?? "خطای نامشخص",
      });
      return;
    }
    setBody("");
  }

  const canSend = body.trim().length > 0 && !sending;

  return (
    <div className="space-y-3">
      {/* رشته کامنت‌ها */}
      {list.length === 0 ? (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-4 text-xs text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          هنوز کامنتی نیست — اولین نفر باشید
        </div>
      ) : (
        <div className="scrollbar-persian max-h-44 space-y-2.5 overflow-y-auto pl-1">
          {list.map((c) => {
            const isMine = c.authorId === currentUserId;
            return (
              <div
                key={c.id}
                className={`flex items-start gap-2 ${
                  isMine ? "justify-end" : "justify-start"
                }`}
              >
                {!isMine && (
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-muted text-[10px] font-bold text-muted-foreground">
                      {nameLetter(c.authorName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    isMine
                      ? "border border-primary/25 bg-primary/10 dark:border-primary/25 dark:bg-primary/15"
                      : "border bg-muted"
                  }`}
                >
                  <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4">
                    <span className="font-medium">{c.authorName}</span>
                    {isMine && (
                      <span className="text-primary">
                        (من)
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {friendlyTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs leading-5">
                    {c.body}
                  </p>
                </div>
                {isMine && (
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary dark:bg-primary/25">
                      {nameLetter(c.authorName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* فرم افزودن کامنت */}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="نوشتن کامنت… (Enter برای ارسال)"
          className="h-9 text-xs"
          maxLength={500}
          disabled={sending || !currentUserId}
        />
        <Button
          type="submit"
          size="icon"
          className="size-9 shrink-0"
          disabled={!canSend}
          aria-label="ارسال کامنت"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 -scale-x-100" />
          )}
        </Button>
      </form>
    </div>
  );
}
