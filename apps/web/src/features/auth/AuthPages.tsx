import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import { Button, Callout, Card, Checkbox, Field, Input } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { useDemo } from "@/store/demoStore";
import { isEmail } from "@/lib/money";
import { apiFetch } from "@/services/api/http";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { PaymentLifecycleVisual } from "@/features/marketing/visuals";

/**
 * Demo access is env-gated and never hardcoded: credentials live in
 * `.env.local` (gitignored). In builds where VITE_DEMO_MODE is not exactly
 * "true", DEMO_ENABLED is constant-false and this whole demo path (with the
 * credential literals) is dead-code-eliminated from the bundle.
 */
const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Branded side panel */}
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b5f56] via-accent to-[#0a4f47] p-10 text-white xl:p-12 lg:flex">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-20" />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl [animation:drift_16s_ease-in-out_infinite]"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl [animation:drift_20s_ease-in-out_infinite_reverse]"
        />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="EzPayz" className="h-8 w-8 rounded-[10px] object-cover" />
            <span className="text-[20px] font-semibold tracking-[-0.01em]">EzPayz</span>
          </Link>
        </div>
        <Stagger className="relative space-y-9" gap={0.14}>
          <StaggerItem>
            <h2 className="font-display text-[44px] leading-[1.06] xl:text-[50px]">
              Payments that <span className="italic">settle themselves</span>.
            </h2>
            <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-white/70">
              The non-custodial {TOKEN.symbol} payment gateway for Whitechain.
            </p>
          </StaggerItem>
          <StaggerItem>
            <PaymentLifecycleVisual />
          </StaggerItem>
        </Stagger>
        <p className="relative inline-flex items-center gap-2 text-[13px] font-medium text-white/55">
          <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {TOKEN.symbol} · {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId} — demo, everything
          is simulated
        </p>
      </aside>

      {/* Form side */}
      <main className="relative flex flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden">
            <img src="/logo.png" alt="EzPayz" className="h-8 w-8 rounded-[10px] object-cover shadow-xs" />
            <span className="text-[18px] font-semibold tracking-[-0.01em] text-ink">EzPayz</span>
          </Link>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 text-[16px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </header>
        <div className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:pt-0">
          <FadeIn className="w-full max-w-[420px]">
            <h1 className="font-display text-[38px] leading-[1.05] text-ink sm:text-[40px]">{title}</h1>
            <p className="mt-2 text-[18px] leading-relaxed text-ink-3">{subtitle}</p>
            <Card className="mt-8 p-6 shadow-sm">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
                className="contents"
              >
                {children}
              </motion.div>
            </Card>
            {footer ? <div className="mt-6 text-center text-[16px] text-ink-3">{footer}</div> : null}
          </FadeIn>
        </div>
      </main>
    </div>
  );
}

function StaggerField({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function SignIn() {
  const signIn = useDemo((s) => s.signIn);
  const enterDemoMode = useDemo((s) => s.enterDemoMode);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Demo credential — frontend-only, no API call. Flips the app into demo
      // mode (mock adapter + seed data) so the dashboard works without a backend.
      if (DEMO_ENABLED && email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        enterDemoMode(DEMO_EMAIL);
        setLoading(false);
        navigate("/dashboard");
        return;
      }
      const res = await apiFetch<{ merchantId: string; token: string }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ businessEmail: email, password }),
      });
      localStorage.setItem("wcp_token", res.token);
      localStorage.setItem("wcp_merchant_id", res.merchantId);
      signIn(email);
      setLoading(false);
      navigate("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={
        <>
          Welcome <span className="italic text-accent">back</span>.
        </>
      }
      subtitle="Access your merchant dashboard, payments, and settings."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <StaggerField>
          <Field label="Work email" required htmlFor="si-email">
            <Input
              id="si-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.example"
              invalid={Boolean(error) && !isEmail(email)}
            />
          </Field>
        </StaggerField>
        <StaggerField>
          <Field label="Password" required htmlFor="si-password">
            <Input
              id="si-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </StaggerField>
        <StaggerField>
          <div className="flex items-center justify-between">
            <Checkbox label="Keep me signed in" checked={remember} onChange={setRemember} />
            <Link to="/forgot-password" className="text-[16px] font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        </StaggerField>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Callout tone="danger" title="Could not sign in">
              {error}
            </Callout>
          </motion.div>
        ) : null}
        <StaggerField>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Sign in
          </Button>
        </StaggerField>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const signIn = useDemo((s) => s.signIn);
  const setStep = useDemo((s) => s.setOnboardingStep);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string | null> = {
      name: form.name.trim().length < 2 ? "Enter your business name" : null,
      email: !isEmail(form.email) ? "Enter a valid email address" : null,
      password: form.password.length < 8 ? "Use at least 8 characters" : null,
      accept: accept ? null : "You need to accept the terms to continue",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ merchantId: string; token: string }>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ businessName: form.name, businessEmail: form.email, password: form.password }),
      });
      localStorage.setItem("wcp_token", res.token);
      localStorage.setItem("wcp_merchant_id", res.merchantId);
      signIn(form.email);
      setStep(0);
      setLoading(false);
      navigate("/onboarding");
    } catch (e) {
      setErrors({ ...next, email: (e as Error).message });
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={
        <>
          Create your <span className="italic text-accent">workspace</span>.
        </>
      }
      subtitle="You will configure your business profile, payout wallet and API credentials in onboarding."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <StaggerField>
          <Field label="Business name" required error={errors.name} htmlFor="su-name">
            <Input
              id="su-name"
              value={form.name}
              invalid={Boolean(errors.name)}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Northwind Digital Labs Ltd"
            />
          </Field>
        </StaggerField>
        <StaggerField>
          <Field label="Work email" required error={errors.email} htmlFor="su-email">
            <Input
              id="su-email"
              type="email"
              value={form.email}
              invalid={Boolean(errors.email)}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="billing@company.example"
            />
          </Field>
        </StaggerField>
        <StaggerField>
          <Field label="Password" required error={errors.password} hint="At least 8 characters." htmlFor="su-pass">
            <Input
              id="su-pass"
              type="password"
              value={form.password}
              invalid={Boolean(errors.password)}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </StaggerField>
        <StaggerField>
          <Checkbox
            checked={accept}
            onChange={setAccept}
            label="I accept the terms of service"
            description="By creating an account you agree to the gateway terms. This is a testnet MVP — no real funds are at risk."
          />
        </StaggerField>
        {errors.accept ? <p className="text-[16px] font-medium text-danger">{errors.accept}</p> : null}
        <StaggerField>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={loading}
            icon={accept ? <Check className="h-3.5 w-3.5" /> : undefined}
          >
            Create account
          </Button>
        </StaggerField>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthLayout
      title={
        <>
          Reset your <span className="italic text-accent">password</span>.
        </>
      }
      subtitle="We would email a reset link to your work address."
      footer={
        <Link to="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Callout tone="info" title="Password reset not implemented">
            Password reset is not available in the MVP. Contact your gateway administrator to reset your password.
          </Callout>
          <Link to="/sign-in">
            <Button variant="secondary" className="w-full">
              Return to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <StaggerField>
            <Field label="Work email" required error={error} htmlFor="fp-email">
              <Input
                id="fp-email"
                type="email"
                value={email}
                invalid={Boolean(error)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.example"
              />
            </Field>
          </StaggerField>
          <StaggerField>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </StaggerField>
        </form>
      )}
    </AuthLayout>
  );
}
