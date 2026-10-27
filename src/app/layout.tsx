import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { getBranding, brandingCss } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  return {
    title: { default: b.naam, template: `%s · ${b.naam}` },
    description: `Managementplatform van ${b.naam}`,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/favicon-64.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: b.naam, statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const b = await getBranding();
  return { themeColor: b.zijbalk };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <html lang="nl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCss(b) }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
