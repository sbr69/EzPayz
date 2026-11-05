import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildSeed, type DemoData } from "@/services/mock/seed";
import type { AppNotification } from "@/types";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: "success" | "error" | "info" | "warn";
}

type ListKey = Exclude<keyof DemoData, "merchant" | "gasGuard">;

interface DemoState {
  data: DemoData;
  hydrated: boolean;
  signedIn: boolean;
  signedInEmail: string | null;
  onboardingStep: number;
  toasts: Toast[];
  /* --- plumbing --- */
  reset: () => void;
  signIn: (email: string | null) => void;
  signOut: () => void;
  setOnboardingStep: (step: number) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  patchMerchant: (patch: Partial<DemoData["merchant"]>) => void;
  patchGasGuard: (patch: Partial<DemoData["gasGuard"]>) => void;
  add: <K extends ListKey>(key: K, item: DemoData[K][number]) => void;
  patch: <K extends ListKey>(key: K, id: string, patch: Partial<DemoData[K][number]>) => void;
  remove: (key: ListKey, id: string) => void;
  notify: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const rid = () => `t_${Math.random().toString(36).slice(2, 10)}`;

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      data: buildSeed(),
      hydrated: false,
      signedIn: false,
      signedInEmail: null,
      onboardingStep: 0,
      toasts: [],
      reset: () =>
        set({
          data: buildSeed(),
          onboardingStep: 0,
          toasts: [],
        }),
      signIn: (email) => set({ signedIn: true, signedInEmail: email }),
      signOut: () => set({ signedIn: false, signedInEmail: null }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      pushToast: (t) =>
        set((s) => ({ toasts: [...s.toasts, { ...t, id: rid() }].slice(-4) })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      patchMerchant: (patch) =>
        set((s) => ({ data: { ...s.data, merchant: { ...s.data.merchant, ...patch } } })),
      patchGasGuard: (patch) =>
        set((s) => ({ data: { ...s.data, gasGuard: { ...s.data.gasGuard, ...patch } } })),
      add: (key, item) =>
        set((s) => {
          const list = s.data[key] as unknown[];
          return { data: { ...s.data, [key]: [item, ...list] } as DemoData };
        }),
      patch: (key, id, patch) =>
        set((s) => {
          const list = s.data[key] as { id: string }[];
          return {
            data: {
              ...s.data,
              [key]: list.map((i) => (i.id === id ? { ...i, ...patch } : i)),
            } as DemoData,
          };
        }),
      remove: (key, id) =>
        set((s) => {
          const list = s.data[key] as { id: string }[];
          return { data: { ...s.data, [key]: list.filter((i) => i.id !== id) } as DemoData };
        }),
      notify: (n) =>
        set((s) => ({
          data: {
            ...s.data,
            notifications: [
              { ...n, id: rid(), at: new Date().toISOString(), read: false },
              ...s.data.notifications,
            ].slice(0, 30),
          },
        })),
      markNotificationRead: (id) =>
        set((s) => ({
          data: {
            ...s.data,
            notifications: s.data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          },
        })),
      markAllNotificationsRead: () =>
        set((s) => ({
          data: {
            ...s.data,
            notifications: s.data.notifications.map((n) => ({ ...n, read: true })),
          },
        })),
    }),
    {
      name: "whitepay-demo-store-v1",
      // v2: plan.cumulativeLimit became a required bounded amount (PRD §11.2);
      // persisted v1 plans with a null limit are discarded and re-seeded.
      version: 2,
      partialize: (s) => ({
        data: s.data,
        signedIn: s.signedIn,
        signedInEmail: s.signedInEmail,
        onboardingStep: s.onboardingStep,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/* ------------------------------------------------------------------ */
/* Typed selectors                                                     */
/* ------------------------------------------------------------------ */

export const useData = () => useDemo((s) => s.data);
export const useMerchant = () => useDemo((s) => s.data.merchant);

export function displayName(d: DemoData, customerId: string | null | undefined): string {
  if (!customerId) return "Guest checkout";
  const c = d.customers.find((x) => x.id === customerId);
  return c ? c.name : "Unknown customer";
}
