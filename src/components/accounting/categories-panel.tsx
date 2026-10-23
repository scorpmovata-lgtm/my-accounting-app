"use client";

import { useState } from "react";
import { Tags, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { useToast } from "@/hooks/use-toast";

export function CategoriesPanel() {
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const addCategory = useAccountingStore((s) => s.addCategory);
  const deactivateCategory = useAccountingStore((s) => s.deactivateCategory);
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await addCategory(name);
      setNewName("");
    } catch (e) {
      toast({
        title: "خطا در افزودن سرفصل",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function countForCategory(catId: string): number {
    return transactions.filter((t) => t.categoryId === catId).length;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <Tags className="h-4 w-4" />
          سرفصل‌ها
          <Badge variant="secondary" className="mr-auto">
            {toPersianDigits(categories.length)} سرفصل
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="نام سرفصل جدید (مثلاً: اجاره)"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button onClick={handleAdd} disabled={!newName.trim() || submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            افزودن
          </Button>
        </div>
        <ScrollArea className="h-[320px]">
          <ul className="divide-y divide-border">
            {categories.map((c) => {
              const count = countForCategory(c.id);
              return (
                <li
                  key={c.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {toPersianDigits(count)} تراکنش
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.isActive ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        فعال
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground"
                      >
                        غیرفعال
                      </Badge>
                    )}
                    {c.isActive && count === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deactivateCategory(c.id)}
                      >
                        غیرفعال‌سازی
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          طبق سند طراحی: حذف سرفصلی که تراکنش دارد به‌صورت غیرفعال‌سازی انجام
          می‌شود، نه حذف فیزیکی.
        </div>
      </CardContent>
    </Card>
  );
}
