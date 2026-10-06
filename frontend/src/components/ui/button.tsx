import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium select-none transition-[transform,background-color,color,opacity] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg/50",
  {
    variants: {
      variant: {
        play: "bg-accent text-accent-fg hover:bg-fg",
        ghost:
          "bg-fg/12 text-fg hover:bg-fg/18 shadow-[var(--shadow-border)]",
        line: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:bg-fg/8",
        quiet: "bg-transparent text-fg hover:bg-fg/10",
        live: "bg-live text-fg hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 rounded-sm text-sm",
        md: "h-11 px-5 rounded-md text-sm",
        lg: "h-12 px-6 rounded-md text-base",
        icon: "size-11 rounded-md",
        "icon-sm": "size-9 rounded-sm",
      },
    },
    defaultVariants: { variant: "play", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
