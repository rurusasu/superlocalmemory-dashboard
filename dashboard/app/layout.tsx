import type { Metadata } from 'next'
import './globals.css'
import { LocaleProvider } from './i18n/LocaleContext'

export const metadata: Metadata = {
  title: 'SLM Dashboard',
  description: 'SuperLocalMemory Health & Data Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}
