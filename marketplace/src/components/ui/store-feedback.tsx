"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function StoreFeedback({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 320, damping: 30 }}>
      {children}
      <Toaster position="bottom-right" closeButton visibleToasts={2} toastOptions={{ className: "store-toast" }} />
    </MotionConfig>
  );
}
