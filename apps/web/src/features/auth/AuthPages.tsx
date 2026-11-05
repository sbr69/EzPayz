import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, Callout, Card, Checkbox, Field, Input } from "@/components/ui";
import { useDemo } from "@/store/demoStore";
import { isEmail } from "@/lib/money";
import { apiFetch } from "@/services/api/http";

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-white">
              W
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">EzPayz</span>
          </Link>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-5 text-center text-[12.5px] text-ink-3">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export function SignIn() {
  const signIn = useDemo((s) => s.signIn);
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
      title="Sign in to your workspace"
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
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
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
          <Field label="Password" required htmlFor="si-password">
            <Input
              id="si-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between">
            <Checkbox label="Keep me signed in" checked={remember} onChange={setRemember} />
            <Link to="/forgot-password" className="text-[12.5px] font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          {error ? (
            <Callout tone="danger" title="Could not sign in">
              {error}
            </Callout>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </Card>
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
      title="Create your merchant account"
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
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Business name" required error={errors.name} htmlFor="su-name">
            <Input
              id="su-name"
              value={form.name}
              invalid={Boolean(errors.name)}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Northwind Digital Labs Ltd"
            />
          </Field>
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
          <Field label="Password" required error={errors.password} hint="At least 8 characters." htmlFor="su-pass">
            <Input
              id="su-pass"
              type="password"
              value={form.password}
              invalid={Boolean(errors.password)}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Checkbox
            checked={accept}
            onChange={setAccept}
            label="I accept the terms of service"
            description="By creating an account you agree to the gateway terms. This is a testnet MVP — no real funds are at risk."
          />
          {errors.accept ? <p className="text-[12px] font-medium text-danger">{errors.accept}</p> : null}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
      </Card>
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
      title="Reset your password"
      subtitle="We would email a reset link to your work address."
      footer={
        <Link to="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Card className="p-5">
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
          <form onSubmit={submit} className="space-y-4">
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
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
