import { Manrope } from 'next/font/google'
import { cn } from '@/lib/utils'
import { ProvedorSessaoDoUsuario } from '@/components/compartilhado/sessao-do-usuario'
import { LayoutPrincipal } from '@/components/layout/layout-principal'
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
          <LayoutPrincipal>{children}</LayoutPrincipal>
        </ProvedorSessaoDoUsuario>
      </body>
    </html>
  )
}
