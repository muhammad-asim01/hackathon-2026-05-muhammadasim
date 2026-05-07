import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-none border border-border bg-input px-3 py-2",
          "text-sm text-foreground",
          "ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring",
          "hover:border-muted-foreground/50",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          "read-only:cursor-default read-only:bg-muted/30",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
