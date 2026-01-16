import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import AuthProvider from "@/components/AuthProvider";
import RequireAuthModal from "@/components/RequireAuthModal";
import NavigationProgress from "@/components/NavigationProgress";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { VirtualKeyboardProvider } from "@/contexts/VirtualKeyboardContext";
import { DeviceModeProvider } from "@/contexts/DeviceModeContext";
import { KioskProvider } from "@/contexts/KioskContext";
import { KioskSessionProvider } from "@/contexts/KioskSessionContext";
import { PrinterStatusProvider } from "@/contexts/PrinterStatusContext";
import VirtualKeyboard from "@/components/VirtualKeyboard";
import DeviceModeLogger from "@/components/DeviceModeLogger";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Wish",
  description: "",
  icons: {
    icon: "/resources/logo/logo.ico",
    shortcut: "/resources/logo/logo.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-background">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full text-foreground`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          <DeviceModeProvider>
            <DeviceModeLogger />
            <KioskProvider>
              <PrinterStatusProvider>
              <KioskSessionProvider>
              <ToastProvider>
                <AuthModalProvider>
                  <VirtualKeyboardProvider>
                    <RequireAuthModal
                      protectedPaths={["/contacts", "/my-cards", "/event"]}
                    >
                      <AppChrome>{children}</AppChrome>
                    </RequireAuthModal>
                    <VirtualKeyboard />
                  </VirtualKeyboardProvider>
                </AuthModalProvider>
              </ToastProvider>
              </KioskSessionProvider>
              </PrinterStatusProvider>
            </KioskProvider>
          </DeviceModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
