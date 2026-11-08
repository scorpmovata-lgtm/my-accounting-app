"use client";

// اسپارک‌لاین سبک SVG — بدون وابستگی، هماهنگ با Design System
// ---------------------------------------------------------------
// داده عددی را به یک نمودار خطی کوچک با گرادیان ملایم تبدیل می‌کند.
// برای کارت‌های خلاصه مالی داشبورد (روند ۱۴ روز اخیر).

import { useId, useMemo } from "react";

interface SparklineProps {
  /** دنباله مقادیر (قدیمی‌ترین → جدیدترین) */
  data: number[];
  /** رنگ خط — hex (پیش‌فرض سبز زمردی) */
  color?: string;
  className?: string;
  height?: number;
}

const W = 100;
const H = 34;
const PAD = 3;

export function Sparkline({
  data,
  color = "#059669",
  className,
  height = 36,
}: SparklineProps) {
  const uid = useId().replace(/[:]/g, "");
  const fillId = `spark-fill-${uid}`;

  const { linePath, areaPath } = useMemo(() => {
    const pts = data.length >= 2 ? data.slice() : [0, 0];
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const span = max - min;
    const step = W / (pts.length - 1);
    const coords = pts.map((v, i) => {
      const x = i * step;
      const y =
        span === 0 ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2);
      return [x, y] as const;
    });
    const line = coords
      .map(
        ([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
      )
      .join(" ");
    const area = `${line} L ${W} ${H + 2} L 0 ${H + 2} Z`;
    return { linePath: line, areaPath: area };
  }, [data]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height }}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
