import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ElderShell } from "@/components/elder/ElderShell";

export const metadata: Metadata = {
  title: "Family memories",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4E5D42",
};

export default async function ElderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ElderShell token={token}>{children}</ElderShell>;
}
