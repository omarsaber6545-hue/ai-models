import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Workspace — منصة الأدوات والموديلات",
  description:
    "مساحة عمل ذكية بأسلوب ChatGPT وClaude تجمع موديلات الذكاء الاصطناعي وأدوات المتصفح في مكان واحد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#212121] text-[#ececec] antialiased selection:bg-white/20 selection:text-white">
        {children}
      </body>
    </html>
  );
}
