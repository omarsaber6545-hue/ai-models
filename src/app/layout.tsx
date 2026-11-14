import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Workspace — منصة الأدوات والموديلات",
  description:
    "مساحة عمل ذكية للمحادثات، تحليل الصور والملفات، وأدوات المطورين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexArabic.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#09090b] font-sans text-[#f4f4f5] antialiased selection:bg-[#d97757]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
