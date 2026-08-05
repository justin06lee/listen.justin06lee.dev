import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "listen.",
  description: "whatever justin is listening to, playing here in real time.",
  openGraph: {
    title: "listen.",
    description: "whatever justin is listening to, playing here in real time.",
    url: "https://listen.justin06lee.dev",
    siteName: "listen.justin06lee.dev",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-black text-white">{children}</body>
    </html>
  );
}
