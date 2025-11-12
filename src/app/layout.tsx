import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/layout/header';
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: 'Explorador de Versículos',
  description: 'Busca y explora versículos de la Biblia en múltiples versiones.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body bg-background text-foreground min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
