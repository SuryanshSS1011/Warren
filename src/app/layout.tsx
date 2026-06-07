import type { Metadata } from "next";
import {
  Space_Grotesk,
  Hanken_Grotesk,
  Space_Mono,
  Newsreader,
} from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Warren — Map your curiosity",
  description:
    "Turn your Wikipedia rabbit hole into a beautiful, shareable map. Reading happens inside the map; AI explains every jump.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${hanken.variable} ${spaceMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
