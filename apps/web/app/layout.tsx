import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Geekay Studio — Chỉnh màu ảnh chuyên nghiệp với AI Mentor",
  description:
    "Geekay Studio là trình chỉnh sửa ảnh chuyên nghiệp chạy trên trình duyệt, xem trước thời gian thực bằng GPU và có Trợ lý AI cố vấn màu sắc.",
};

export const viewport: Viewport = {
  themeColor: "#0F0F0F",
  width: "device-width",
  initialScale: 1,
  // Cần thiết để env(safe-area-inset-bottom) trong MobileTabBar hoạt động trên thiết bị có notch/home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
