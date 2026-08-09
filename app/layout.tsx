import type { Metadata } from "next";
import { Cormorant_Garamond, Work_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const title = "Vineyard Sun | Cork Eyewear & Conversation Pieces";
const description =
  "Wine-country cork sunglasses, the bestselling Positive Cash Flow embroidered pillow, and conversation pieces from Vineyard Sun.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const rawHost = forwardedHost ?? requestHeaders.get("host") ?? "vineyardsun.com";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost)
    ? rawHost
    : "vineyardsun.com";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || host.startsWith("localhost")
      ? "http"
      : "https";
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    title,
    description,
    icons: { icon: "/brand/syrah.jpg" },
    openGraph: {
      type: "website",
      url: origin,
      siteName: "Vineyard Sun",
      title,
      description,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: "Vineyard Sun vineyard at golden hour",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
