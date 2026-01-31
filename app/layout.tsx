import type { Metadata } from 'next'
import { ClientLayout } from './components/ClientLayout'

export const metadata: Metadata = {
  title: 'LunaFace',
  description: 'Animated face with camera tracking + Groq mood director',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
