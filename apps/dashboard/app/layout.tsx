import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrowserSpace — Profile Workspace",
  description: "A privacy-first workspace for isolated browser profiles and proxy settings.",
  applicationName: "Reachmark BrowserSpace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
