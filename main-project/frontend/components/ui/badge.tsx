import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-primary border border-primary/30",
        secondary:
          "bg-secondary text-secondary-foreground border border-border",
        destructive:
          "bg-destructive/20 text-destructive border border-destructive/30",
        outline: "border border-border text-foreground bg-transparent",
        success:
          "bg-lp-green/15 text-lp-green border border-lp-green/30",
        warning:
          "bg-lp-amber/15 text-lp-amber border border-lp-amber/30",
        error: "bg-lp-red/15 text-lp-red border border-lp-red/30",
        muted: "bg-muted text-muted-foreground border border-border",
        info: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
