import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SLM Dashboard',
  description: 'SuperLocalMemory Health & Data Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-950 text-gray-100">{children}</body>
    </html>
  )
}
