import type { Metadata } from "next";
import Script from "next/script";
import {
  Space_Grotesk,
  Hanken_Grotesk,
  Space_Mono,
  Newsreader,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import PendoInitializer from "@/components/PendoInitializer";

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
  // Public Pendo app id (safe to ship to the browser). Optional — unset disables Pendo.
  const pendoApiKey = process.env.NEXT_PUBLIC_PENDO_API_KEY;
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${hanken.variable} ${spaceMono.variable} ${newsreader.variable} h-full`}
    >
      {/* Pendo web SDK loader. The API key is a public client-side id sourced from
          NEXT_PUBLIC_PENDO_API_KEY so it differs per environment / can be disabled without a
          code change. When unset, nothing loads (the agent + initializer are skipped). */}
      {pendoApiKey ? (
        <Script id="pendo-install" strategy="beforeInteractive">{`
(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})(${JSON.stringify(pendoApiKey)});
`}</Script>
      ) : null}
      <body className="h-full">
        {pendoApiKey ? <PendoInitializer /> : null}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
