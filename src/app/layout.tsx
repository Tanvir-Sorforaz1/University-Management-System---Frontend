import type { Metadata } from "next";
import { Figtree, Hind_Siliguri, Literata } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-ui",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Bangladesh University",
  description: "Your academic record, in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${figtree.variable} ${literata.variable} ${hindSiliguri.variable}`}>
      <body className="min-h-screen">
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
        <Toaster position="top-right" richColors={false} />
      </body>
    </html>
  );
}
