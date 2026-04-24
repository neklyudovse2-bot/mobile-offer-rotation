import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
 subsets: ["latin", "cyrillic"], 
 weight: ["400", "500", "600", "700"],
 variable: '--font-inter',
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
 <html lang="ru" className={inter.variable}>
 <body className="antialiased">
 {children}
 </body>
 </html>
 );
}
