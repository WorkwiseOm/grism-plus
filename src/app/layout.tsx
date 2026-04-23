import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Grism Plus",
  description: "Talent Development Execution Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans flex min-h-screen", inter.variable)}>
      <body className="flex flex-col min-h-screen w-full font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
