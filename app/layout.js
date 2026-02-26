import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Updated the title and added the manifest link
export const metadata = {
  title: "Fight IQ",
  description: "The ultimate MMA fantasy & drafting platform.",
  manifest: "/manifest.json",
};

// 2. Added the viewport export to color the notch/status bar on phones
export const viewport = {
  themeColor: "#db2777",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}