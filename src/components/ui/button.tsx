import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/20 focus-visible:border-indigo-600 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs active:bg-indigo-800",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
        outline:
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-xs active:bg-zinc-100",
        secondary:
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-xs active:bg-zinc-100",
        ghost:
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        link:
          "text-indigo-600 underline-offset-4 hover:underline",
        subtle:
          "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-sm rounded-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
