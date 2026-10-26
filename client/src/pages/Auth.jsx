import { useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MIN_PASSWORD, cleanAccount, validateAccount, validatePassword } from "../../../shared/validate.js";
import { api } from "../api.js";
import { safeNext, useAuth } from "../auth.js";
import { useConfig } from "../config.js";
import { Banner, Field, Icon, inputClass, primaryButton, telHref } from "../components/ui.jsx";

// Participant login, sign-up and password reset.

function AuthCard({ title, intro, children, footer }) {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-10">
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">State Conference 2026</p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
            {intro && <p className="mt-2 text-[15px] text-on-surface-variant">{intro}</p>}
          </div>
          {children}
        </div>
      </div>
      {footer && <p className="mt-5 text-center text-[15px] text-on-surface-variant">{footer}</p>}
    </section>
  );
}

function PasswordInput({ id, value, onChange, error, autoComplete }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={onChange}
        aria-invalid={!!error} className={`${inputClass(error)} pr-14`}
      />
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide password" : "Show password"}
        className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
        <Icon name={shown ? "visibility_off" : "visibility"} className="text-[22px]" />
      </button>
    </div>
  );
}

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest);
  };
  async function submit(e, check, action) {
    e.preventDefault();
    const errs = check?.() || {};
    setErrors(errs);
    setBanner("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setErrors(err.fields || {});
      setBanner(err.message);
    } finally {
      setBusy(false);
    }
  }
  return { values, errors, banner, busy, set, submit };
}

export function Login() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const next = safeNext(useSearchParams()[0].get("next"));
  const f = useForm({ email: "", password: "" });

  if (token) return <Navigate to={next} replace />;

  const onSubmit = (e) =>
    f.submit(e, null, async () => {
      login(await api("/auth/login", { method: "POST", body: f.values }));
      navigate(next, { replace: true });
    });

  return (
    <AuthCard title="Log in to your account"
      intro="Log in to register for the conference, check your payment status and open your Bhojan Pass."
      footer={<>New here?{" "}<Link className="font-semibold text-primary underline" to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {f.banner && <Banner>{f.banner}</Banner>}
        <Field id="login-email" label="Email address" required>
          <input id="login-email" type="email" inputMode="email" autoComplete="email" autoFocus value={f.values.email} onChange={f.set("email")} className={inputClass()} />
        </Field>
        <Field id="login-password" label="Password" required>
          <PasswordInput id="login-password" autoComplete="current-password" value={f.values.password} onChange={f.set("password")} />
        </Field>
        <button className={`${primaryButton} w-full`} disabled={f.busy || !f.values.email || !f.values.password}>
          <Icon name="login" className="text-[20px]" />
          {f.busy ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center">
          <Link to="/forgot" className="text-[15px] font-semibold text-primary underline">Forgot password?</Link>
        </p>
      </form>
    </AuthCard>
  );
}

export function Signup() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const params = useSearchParams()[0];
  const next = safeNext(params.get("next") || "/register");
  const f = useForm({ name: "", email: "", mobile: "", password: "" });

  if (token) return <Navigate to={next} replace />;

  const onSubmit = (e) =>
    f.submit(e, () => validateAccount(cleanAccount(f.values), f.values.password), async () => {
      login(await api("/auth/signup", { method: "POST", body: { ...cleanAccount(f.values), password: f.values.password } }));
      navigate(next, { replace: true });
    });

  return (
    <AuthCard title="Create your account"
      intro="One account per participant. You will use it to register, upload your payment screenshot and get your Bhojan Pass."
      footer={<>Already have an account?{" "}<Link className="font-semibold text-primary underline" to={`/login?next=${encodeURIComponent(next)}`}>Log in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {f.banner && <Banner>{f.banner}</Banner>}
        <Field id="su-name" label="Full name" required error={f.errors.name}>
          <input id="su-name" autoComplete="name" autoFocus value={f.values.name} onChange={f.set("name")} placeholder="e.g. Dr. Vinodbhai Kantilal Patel" className={inputClass(f.errors.name)} />
        </Field>
        <Field id="su-email" label="Email address" required error={f.errors.email}
          hint="Your Bhojan Pass and certificate are emailed here." hintIcon="mail">
          <input id="su-email" type="email" inputMode="email" autoComplete="email" value={f.values.email} onChange={f.set("email")} placeholder="name@college.ac.in" className={inputClass(f.errors.email)} />
        </Field>
        <Field id="su-mobile" label="Mobile number" required error={f.errors.mobile}>
          <div className={`flex items-stretch overflow-hidden rounded-xl shadow-sm ${f.errors.mobile ? "ring-2 ring-error" : "ring-[1.5px] ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary"}`}>
            <div className="flex select-none items-center bg-surface-container px-4 font-semibold">+91</div>
            <input id="su-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={f.values.mobile} onChange={f.set("mobile")} placeholder="98250 XXXXX" className="h-14 min-w-0 flex-1 bg-surface-container-lowest px-4" />
          </div>
        </Field>
        <Field id="su-password" label={`Password (at least ${MIN_PASSWORD} characters)`} required error={f.errors.password}>
          <PasswordInput id="su-password" autoComplete="new-password" value={f.values.password} onChange={f.set("password")} error={f.errors.password} />
        </Field>
        <button className={`${primaryButton} w-full`} disabled={f.busy}>
          <Icon name="person_add" className="text-[20px]" />
          {f.busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}

export function Forgot() {
  const contacts = useConfig()?.contacts || [];
  const f = useForm({ email: "" });
  const [done, setDone] = useState(null);

  const onSubmit = (e) =>
    f.submit(e, null, async () => setDone(await api("/auth/forgot", { method: "POST", body: f.values })));

  return (
    <AuthCard title="Forgot your password?"
      intro="Enter the email you signed up with and we will email you a link to choose a new password."
      footer={<Link className="font-semibold text-primary underline" to="/login">Back to log in</Link>}>
      {done ? (
        done.mailEnabled ? (
          <p className="rounded-xl border border-[#bde7cc] bg-[#eff9f2] p-4 text-[15px] text-[#0b5c2f]">
            If an account exists for <b>{f.values.email}</b>, a reset link is on its way. It works for 30 minutes; check your spam folder too.
          </p>
        ) : (
          <Banner>
            Password reset by email is not available right now. Please call the organising team
            {contacts[0] ? <> on <a className="font-semibold underline" href={telHref(contacts[0].phone)}>{contacts[0].phone}</a></> : null}.
          </Banner>
        )
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {f.banner && <Banner>{f.banner}</Banner>}
          <Field id="fg-email" label="Email address" required>
            <input id="fg-email" type="email" inputMode="email" autoComplete="email" autoFocus value={f.values.email} onChange={f.set("email")} className={inputClass()} />
          </Field>
          <button className={`${primaryButton} w-full`} disabled={f.busy || !f.values.email}>
            <Icon name="mail" className="text-[20px]" />
            {f.busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function Reset() {
  const { token } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const f = useForm({ password: "", confirm: "" });

  const check = () => {
    const pw = validatePassword(f.values.password);
    if (pw) return { password: pw };
    if (f.values.password !== f.values.confirm) return { confirm: "The two passwords do not match." };
    return {};
  };
  const onSubmit = (e) =>
    f.submit(e, check, async () => {
      login(await api("/auth/reset", { method: "POST", body: { token, password: f.values.password } }));
      navigate("/account", { replace: true });
    });

  return (
    <AuthCard title="Choose a new password"
      footer={<Link className="font-semibold text-primary underline" to="/forgot">Get a new reset link</Link>}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {f.banner && <Banner>{f.banner}</Banner>}
        <Field id="rs-password" label={`New password (at least ${MIN_PASSWORD} characters)`} required error={f.errors.password}>
          <PasswordInput id="rs-password" autoComplete="new-password" value={f.values.password} onChange={f.set("password")} error={f.errors.password} />
        </Field>
        <Field id="rs-confirm" label="Type it again" required error={f.errors.confirm}>
          <PasswordInput id="rs-confirm" autoComplete="new-password" value={f.values.confirm} onChange={f.set("confirm")} error={f.errors.confirm} />
        </Field>
        <button className={`${primaryButton} w-full`} disabled={f.busy}>
          {f.busy ? "Saving…" : "Save password and log in"}
        </button>
      </form>
    </AuthCard>
  );
}
