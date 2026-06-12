import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ProvedorSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { LayoutCondicional } from '@/components/layout/layout-condicional'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={cn('dark font-sans', manrope.variable)}>
      <body>
        <ProvedorSessaoDoUsuario>
          <LayoutCondicional>{children}</LayoutCondicional>
        </ProvedorSessaoDoUsuario>
      </body>
    </html>
  )
}
