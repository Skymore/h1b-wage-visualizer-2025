
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { SnowProvider } from "@/components/SnowContext";
import { SnowEffect } from "@/components/SnowEffect";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "H1B Wage Visualization",
  description: "Visualize H1B Wages by Occupation and Location",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Explicitly load messages based on the route param to avoid context issues
  let messages;
  try {
    messages = (await import(`../../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../../messages/en.json`)).default;
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <SnowProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <SnowEffect />
              {children}
              <ChatWidget />
            </ThemeProvider>
          </SnowProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
