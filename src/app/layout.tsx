import type { Metadata, Viewport } from "next";
import {
  Vazirmatn,
  Noto_Naskh_Arabic,
  Noto_Kufi_Arabic,
  IBM_Plex_Sans_Arabic,
  Cairo,
  El_Messiri,
  Markazi_Text,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { RegisterSW } from "@/components/pwa/register-sw";
import { APPEARANCE_INIT_SCRIPT } from "@/lib/appearance";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

// ─── فونت‌های جایگزین قابل انتخاب ───
// فقط وقتی کاربر آن‌ها را انتخاب کند بارگذاری می‌شوند (preload خاموش)؛
// همهٔ این فونت‌ها زیرمجموعهٔ Arabic کامل (U+0600-06FF) و حروف خاص فارسی
// (پ چ ژ گ) را پوشش می‌دهند و به وزیرمتن fallback می‌شوند.
const notoNaskh = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

const notoKufi = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

const elMessiri = El_Messiri({
  variable: "--font-el-messiri",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

const markazi = Markazi_Text({
  variable: "--font-markazi",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "دفتر حساب کتاب — دفتر بدهی و طلب",
  description:
    "دفتر شخصی برای ثبت دقیق بدهی و طلب، با تقویم هجری شمسی و موتور حسابداری مطمئن.",
  keywords: [
    "حسابداری",
    "بدهی",
    "طلب",
    "دفتر",
    "تقویم شمسی",
    "تلگرام",
    "دفتر حساب کتاب",
  ],
  applicationName: "دفتر حساب کتاب",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "دفتر حساب کتاب",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={`${vazirmatn.variable} ${notoNaskh.variable} ${notoKufi.variable} ${plexArabic.variable} ${cairo.variable} ${elMessiri.variable} ${markazi.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        {/* اعمال قالب/فونت ذخیره‌شده پیش از رندر — بدون فلش رنگی */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
