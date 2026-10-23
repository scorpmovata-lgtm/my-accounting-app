"use client";

import { useState } from "react";
import { Tags, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { toPersianDigits } from "@/lib/accounting/jalali";

export function CategoriesPanel() {
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);
  const addCategory = useAccountingStore((s) => s.addCategory);
  const deactivateCategory = useAccountingStore(
    (s) => s.deactivateCategory
  );
  const [newName, setNewName] = useState("");

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addCategory(name);
    setNewName("");
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
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
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
