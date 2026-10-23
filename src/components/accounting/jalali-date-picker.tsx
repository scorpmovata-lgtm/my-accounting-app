"use client";

import { useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS_SHORT,
  formatJalaliLong,
  fromJalaliToISO,
  getWeekdayShanbe,
  jalaliMonthLength,
  toJalali,
  toPersianDigits,
} from "@/lib/accounting/jalali";

interface JalaliDatePickerProps {
  value?: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  placeholder?: string;
}

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = toJalali(new Date());
  const [view, setView] = useState(() => {
    if (value) {
      const v = toJalali(value);
      return { jy: v.jy, jm: v.jm };
    }
    return { jy: today.jy, jm: today.jm };
  });

  const days = useMemo(() => {
    const length = jalaliMonthLength(view.jy, view.jm);
    const firstWeekday = getWeekdayShanbe(view.jy, view.jm, 1); // 0..6, شنبه=0
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= length; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  function handleSelect(day: number) {
    const iso = fromJalaliToISO(view.jy, view.jm, day);
    onChange(iso);
    setOpen(false);
  }

  function prevMonth() {
    setView((v) =>
      v.jm === 1
        ? { jy: v.jy - 1, jm: 12 }
        : { jy: v.jy, jm: v.jm - 1 }
    );
  }
  function nextMonth() {
    setView((v) =>
      v.jm === 12
        ? { jy: v.jy + 1, jm: 1 }
        : { jy: v.jy, jm: v.jm + 1 }
    );
  }
  function prevYear() {
    setView((v) => ({ ...v, jy: v.jy - 1 }));
  }
  function nextYear() {
    setView((v) => ({ ...v, jy: v.jy + 1 }));
  }

  const selected = value ? toJalali(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-right font-normal"
        >
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0" />
          {value ? (
            formatJalaliLong(value)
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="p-3" dir="rtl">
          {/* نوار ناوبری */}
          <div className="flex items-center justify-between mb-3 gap-1">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={prevYear}
                title="سال قبل"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -mr-2" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={prevMonth}
                title="ماه قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="font-medium text-sm px-2">
              {PERSIAN_MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nextMonth}
                title="ماه بعد"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nextYear}
                title="سال بعد"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -mr-2" />
              </Button>
            </div>
          </div>

          {/* سر ستون‌های روز هفته */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {PERSIAN_WEEKDAYS_SHORT.map((w, i) => (
              <div
                key={i}
                className="text-center text-xs text-muted-foreground py-1 font-medium"
              >
                {w}
              </div>
            ))}
          </div>

          {/* روزهای ماه */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (day === null) {
                return <div key={i} className="h-9 w-9" />;
              }
              const isToday =
                day === today.jd &&
                view.jm === today.jm &&
                view.jy === today.jy;
              const isSelected =
                selected &&
                day === selected.jd &&
                view.jm === selected.jm &&
                view.jy === selected.jy;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    "h-9 w-9 rounded-md text-sm transition-colors flex items-center justify-center",
                    isSelected && "bg-primary text-primary-foreground font-bold",
                    !isSelected &&
                      isToday &&
                      "ring-1 ring-primary text-primary font-medium",
                    !isSelected && !isToday && "hover:bg-accent"
                  )}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
