import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Rotation Admin | Marcus Vitruvius",
  description: "Offer Rotation Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-[#f5f6f8] text-[#313a46] antialiased`}>
        {children}
      </body>
    </html>
  );
}
