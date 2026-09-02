import type { Metadata } from 'next'
import Script from 'next/script'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'mex / play beyond',
  description: 'Mex — a green space for games.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Script src="https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js" />
        {children}
      </body>
    </html>
  )
}
