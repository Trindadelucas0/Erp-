import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof Button>

export function BotaoPrimario({ className, children, ...props }: Props) {
  return (
    <Button className={cn('w-full sm:w-auto', className)} {...props}>
      {children}
    </Button>
  )
}
