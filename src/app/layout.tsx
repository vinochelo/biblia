import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/layout/header';
import { NavDock } from '@/components/layout/nav-dock';
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: 'Explorador Bíblico - Lectura, Audio y Estudio',
  description: 'Explora, lee y escucha la Biblia con narración en audio y herramientas de estudio inteligente.',
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
      <body className="font-body bg-background text-foreground min-h-screen flex flex-col antialiased pb-20 md:pb-0">
        <Header />
        <main className="flex-1">{children}</main>
        <NavDock />
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

