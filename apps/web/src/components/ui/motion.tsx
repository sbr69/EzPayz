import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";

/* Shared easing/duration tokens — mirrors the design system in index.css */
export const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];
export const EASE_SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

/* ---------------------------------- FadeIn --------------------------------- */

export function FadeIn({
  children,
  delay = 0,
  y = 8,
  duration = 0.45,
  className,
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE_OUT_QUART }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------------- Stagger --------------------------------- */

export function Stagger({
  children,
  delay = 0,
  gap = 0.06,
  className,
}: {
  children: ReactNode;
  delay?: number;
  gap?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 10,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT_QUART } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------- Reveal (scroll-in) --------------------------- */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: EASE_OUT_QUART }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ PageTransition ----------------------------- */

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT_QUART }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------- PopAnimation ------------------------------ */

export function PopIn({
  children,
  className,
  scale = 0.96,
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale, y: 4, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------- DrawnCheck ------------------------------- */

export function DrawnCheck({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      className={className}
      initial="hidden"
      animate="visible"
      aria-hidden
    >
      <motion.circle
        cx="28"
        cy="28"
        r="26"
        stroke="currentColor"
        strokeWidth="2.5"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 0.55, ease: EASE_OUT_QUART },
          },
        }}
      />
      <motion.path
        d="M17 29.5 L25 37 L39 21"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{
          hidden: { pathLength: 0 },
          visible: {
            pathLength: 1,
            transition: { duration: 0.4, delay: 0.45, ease: EASE_OUT_QUART },
          },
        }}
      />
    </motion.svg>
  );
}

/* ------------------------------- Hover helpers ----------------------------- */

export const hoverLift = "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md";
