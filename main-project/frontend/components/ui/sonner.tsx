"use client";

import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            "group-[.toaster]:bg-card",
            "group-[.toaster]:text-foreground",
            "group-[.toaster]:border group-[.toaster]:border-border",
            "group-[.toaster]:rounded-none",
            "group-[.toaster]:shadow-popover",
          ].join(" "),
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full",
          success:
            "group-[.toaster]:border-lp-green/30 group-[.toaster]:text-lp-green",
          error:
            "group-[.toaster]:border-lp-red/30 group-[.toaster]:text-lp-red",
          warning:
            "group-[.toaster]:border-lp-amber/30 group-[.toaster]:text-lp-amber",
          info: "group-[.toaster]:border-blue-500/30 group-[.toaster]:text-blue-400",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
