import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/frontend/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loopen — Brand systems, not random logos",
  description:
    "AI creative direction that turns a sharp brief into an original, scalable brand system.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Loopen — Brand systems, not random logos",
    description:
      "Strategy-first AI creative direction for original, scalable brand identities.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Loopen" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loopen — Brand systems, not random logos",
    description:
      "Strategy-first AI creative direction for original, scalable brand identities.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
