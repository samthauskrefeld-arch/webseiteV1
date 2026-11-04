import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Assistant } from "@/components/shell/assistant";
import { Intro } from "@/components/shell/intro";
import { BottomNav, MobileHeader, Sidebar } from "@/components/shell/nav";
import { SwRegister } from "@/components/shell/sw-register";
import { ToastProvider } from "@/components/ui/toast";
import { currentMe } from "@/server/current-user";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "My Minijob – Finde Hilfe. Finde Arbeit.", template: "%s · My Minijob" },
  description: "Flexible Jobs und Hilfe in deiner Nähe: Garten, Haushalt, Nachhilfe, Events, Büro, Handwerk, Teilzeit, Vollzeit und Ausbildung. Bewerben ist kostenlos.",
  applicationName: "My Minijob",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "My Minijob", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F9FC" },
    { media: "(prefers-color-scheme: dark)", color: "#101722" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('mmj_theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const me = await currentMe();
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-[90] rounded-[14px] bg-primary px-4 py-3 font-semibold text-on-primary">
          Zum Inhalt springen
        </a>
        <SessionProvider initial={me}>
          <ToastProvider>
            <div className="flex min-h-dvh">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
                  {children}
                </main>
              </div>
            </div>
            <BottomNav />
            <Assistant />
            <Intro />
            <SwRegister />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
