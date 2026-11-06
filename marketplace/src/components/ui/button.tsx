import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("ui-button", {
  variants: { variant: { primary: "ui-button-primary", outline: "ui-button-outline" },
    size: { default: "ui-button-default", icon: "ui-button-icon" } },
  defaultVariants: { variant: "primary", size: "default" },
});

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & VariantProps<typeof variants>) {
  return <button className={cn(variants({ variant, size }), className)} {...props} />;
}
