import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ 
  subsets: ["latin", "cyrillic"], 
  weight: ["400", "500", "600", "700"],
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  title: "Rotation Admin",
  description: "Offer Rotation Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={geist.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
