import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Crossmeeting',
  description: 'Chief of Staff inteligente para suas reuniões',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} bg-[#0E1117] text-white antialiased h-full`}>
        {children}
      </body>
    </html>
  )
}
