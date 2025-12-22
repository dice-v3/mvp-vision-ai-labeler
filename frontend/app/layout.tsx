import type { Metadata } from "next"
import { AuthSessionProvider } from "@/lib/auth/session-provider"
import { ToastContainer } from "@/components/ui/Toast"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import "./globals.css"

export const metadata: Metadata = {
  title: "Vision AI Labeler",
  description: "Web-based annotation tool for Vision AI Training Platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
        <ToastContainer />
        <ConfirmDialog />
      </body>
    </html>
  )
}
