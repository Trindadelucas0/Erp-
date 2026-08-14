import * as React from "react"

import { classesCampo } from '@/components/ui/classes-campo'
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        classesCampo,
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground text-base md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
