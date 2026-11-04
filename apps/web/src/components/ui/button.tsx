"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-semibold select-none whitespace-nowrap transition-[background,color,box-shadow,transform] duration-200 ease-[var(--ease-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 min-h-11 min-w-11",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
        accent: "bg-accent text-[#062824] hover:bg-accent-hover",
        secondary: "bg-surface text-text border border-border hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-error text-white hover:brightness-110",
        link: "text-accent-text underline-offset-4 hover:underline px-0 min-h-0",
      },
      size: {
        sm: "h-11 px-4 text-sm rounded-[14px]",
        md: "h-12 px-5 text-[15px] rounded-[14px]",
        lg: "h-14 px-6 text-base rounded-[14px]",
        icon: "h-11 w-11 rounded-[14px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(button({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? children : <>{loading && <Spinner className="size-4" />}{children}</>}
    </Comp>
  );
});
Button.displayName = "Button";
