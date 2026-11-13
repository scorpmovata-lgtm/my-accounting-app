"use client";

// «جمع‌بندی دسته‌بندی‌ها» در داشبورد — نسخه Premium
// -------------------------------------------------------------------
// بالای کارت: نمودار دونات (۵ دسته برتر + سایر) با راهنمای درصدی.
// پایین کارت: ردیف‌های جزئیات با نوار پیشرفت دوجانبه
// (طلب‌ساز از چپ، بدهی‌ساز از راست) و مقادیر عددی.

import { useMemo } from "react";
import { Tag, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { computeCategoryTotals } from "@/lib/accounting/engine";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { DonutChart, DONUT_PALETTE, type DonutSlice } from "./ui/donut-chart";

/** قالب عدد با جداکننده هزارگان و ارقام فارسی (بدون واحد) */
function fmtNum(n: number): string {
  return toPersianDigits(n.toLocaleString("en-US"));
}

export function CategoryBreakdown() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);
  const categories = useAccountingStore((s) => s.categories);

  const totals = useMemo(
    () =>
      currentUserId
        ? computeCategoryTotals(currentUserId, transactions)
        : [],
    [currentUserId, transactions]
  );

  // قطاع‌های دونات: ۵ دسته برتر + «سایر»
  const donutSlices = useMemo<DonutSlice[]>(() => {
    if (totals.length === 0) return [];
    const toSlice = (row: (typeof totals)[number], label: string) => ({
      label,
      value: row.claimTotal + row.debtTotal,
    });
    const named = totals
      .map((row) => ({
        row,
        name: row.categoryId
          ? categories.find((c) => c.id === row.categoryId)?.name ?? "بدون دسته"
          : "بدون دسته",
      }))
      .filter((x) => x.row.claimTotal + x.row.debtTotal > 0);
    const top = named.slice(0, 5);
    const rest = named.slice(5);
    const slices: DonutSlice[] = top.map((x, i) => ({
      label: x.name,
      value: x.row.claimTotal + x.row.debtTotal,
      color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }));
    if (rest.length > 0) {
      slices.push({
        label: "سایر دسته‌ها",
        value: rest.reduce(
          (s, x) => s + x.row.claimTotal + x.row.debtTotal,
          0
        ),
        color: "var(--muted-foreground)",
      });
    }
    return slices;
  }, [totals, categories]);

  // بدون تراکنش → هیچ رندری نداریم
  if (!currentUserId || totals.length === 0) return null;

  const grandTotal = donutSlices.reduce((s, x) => s + x.value, 0);

  return (
    <Card className="rounded-2xl border-border/80 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PieChart className="h-4 w-4" />
          </span>
          جمع‌بندی دسته‌بندی‌ها
          <Badge variant="secondary" className="ms-1 h-5 rounded-full px-2">
            {toPersianDigits(String(totals.length))} دسته
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* دونات + راهنما */}
        {donutSlices.length > 0 && (
          <div className="border-b border-border/70 px-4 py-5 sm:px-5">
            <DonutChart
              slices={donutSlices}
              centerValue={fmtNum(grandTotal)}
              centerLabel="جمع گردش"
              size={150}
              className="mx-auto max-w-md sm:mx-0"
            />
          </div>
        )}

        {/* جزئیات هر دسته */}
        <ScrollArea className="scrollbar-persian max-h-72">
          <ul className="divide-y divide-border/70">
            {totals.map((row) => {
              const cat = row.categoryId
                ? categories.find((c) => c.id === row.categoryId)
                : null;
              const name = cat?.name ?? "بدون دسته";
              const total = row.claimTotal + row.debtTotal;
              const claimPct = total > 0 ? (row.claimTotal / total) * 100 : 0;
              const debtPct = total > 0 ? (row.debtTotal / total) * 100 : 0;
              const netIsClaim = row.net > 0;
              const netIsDebt = row.net < 0;
              return (
                <li
                  key={row.categoryId ?? "none"}
                  className="px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                >
                  {/* نام دسته + تعداد تراکنش */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span className="truncate">{name}</span>
                    </span>
                    <Badge
                      variant="secondary"
                      className="h-5 shrink-0 rounded-full px-2"
                    >
                      {toPersianDigits(String(row.count))} تراکنش
                    </Badge>
                  </div>

                  {/* نوار پیشرفت دوجانبه: طلب‌ساز از چپ، بدهی‌ساز از راست */}
                  <div
                    className="mt-2.5 flex w-full justify-between gap-1"
                    dir="ltr"
                    aria-hidden
                  >
                    <div
                      className="h-1.5 rounded-full bg-emerald-500/70 dark:bg-emerald-600/60"
                      style={{ width: `${claimPct}%` }}
                    />
                    <div
                      className="h-1.5 rounded-full bg-rose-500/70 dark:bg-rose-600/60"
                      style={{ width: `${debtPct}%` }}
                    />
                  </div>

                  {/* مقادیر */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">
                      طلب‌ساز:{" "}
                      <span
                        dir="ltr"
                        className="font-bold text-emerald-700 dark:text-emerald-400"
                      >
                        {fmtNum(row.claimTotal)}
                      </span>{" "}
                      تومان
                    </span>
                    <span className="text-muted-foreground">
                      بدهی‌ساز:{" "}
                      <span
                        dir="ltr"
                        className="font-bold text-rose-700 dark:text-rose-400"
                      >
                        {fmtNum(row.debtTotal)}
                      </span>{" "}
                      تومان
                    </span>
                    <span className="text-muted-foreground">
                      خالص:{" "}
                      <span
                        dir="ltr"
                        className={`font-bold ${
                          netIsClaim
                            ? "text-emerald-700 dark:text-emerald-400"
                            : netIsDebt
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-foreground"
                        }`}
                      >
                        {netIsClaim ? "+" : netIsDebt ? "−" : ""}
                        {fmtNum(Math.abs(row.net))}
                      </span>{" "}
                      تومان
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
