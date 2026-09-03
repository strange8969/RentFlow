import {
  ArrowRight,
  Building2,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { chatGPTSignInPath } from "./chatgpt-auth";

const accessMethods = [
  { label: "Google", mark: "G" },
  { label: "Microsoft", mark: "M" },
  { label: "Email and password", mark: "@" },
  { label: "Email verification", mark: "✦" },
];

export function AuthLanding({ mode = "welcome" }: { mode?: "welcome" | "signup" | "login" }) {
  const continuePath = chatGPTSignInPath("/");

  if (mode !== "welcome") {
    const signingUp = mode === "signup";
    return (
      <main className="auth-shell">
        <AuthBrand />
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <span className="auth-icon"><KeyRound aria-hidden="true" /></span>
            <div>
              <p className="auth-eyebrow">{signingUp ? "New landlord workspace" : "Welcome back"}</p>
              <h1 id="auth-title">{signingUp ? "Create your RentFlow account" : "Sign in to RentFlow"}</h1>
            </div>
          </div>
          <p className="auth-copy">
            {signingUp
              ? "Choose how you want to verify your identity. Your private workspace is created after the secure sign-in step."
              : "Choose the method connected to your account. You’ll return to your protected landlord workspace."}
          </p>
          <div className="auth-methods" aria-label="Account access methods">
            {accessMethods.map((method) => (
              <a key={method.label} className="auth-method" href={continuePath} target="_top">
                <span className="auth-method-mark" aria-hidden="true">{method.mark}</span>
                <span>Continue with {method.label}</span>
                <ArrowRight aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className="auth-security-note">
            <LockKeyhole aria-hidden="true" />
            <p>You’ll choose the matching method on ChatGPT’s secure account screen. RentFlow never receives or stores your password.</p>
          </div>
          <p className="auth-switch">
            {signingUp ? "Already have a RentFlow workspace?" : "New to RentFlow?"}{" "}
            <Link href={signingUp ? "/login" : "/signup"}>{signingUp ? "Sign in" : "Create an account"}</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell auth-shell-welcome">
      <AuthBrand />
      <section className="auth-welcome" aria-labelledby="welcome-title">
        <div className="auth-welcome-copy">
          <p className="auth-eyebrow">Rental operations, kept exact</p>
          <h1 id="welcome-title">A clean ledger for every property you manage.</h1>
          <p>Track rent, electricity, payments, deposits, receipts, and private documents in one workspace built for landlords.</p>
          <div className="auth-actions">
            <Link className="auth-primary" href="/signup">Create landlord account <ArrowRight aria-hidden="true" /></Link>
            <Link className="auth-secondary" href="/login">Sign in</Link>
          </div>
          <div className="auth-trust-row">
            <span><ShieldCheck aria-hidden="true" /> Separate workspace</span>
            <span><Check aria-hidden="true" /> Private documents</span>
            <span><Check aria-hidden="true" /> Auditable ledger</span>
          </div>
        </div>
        <div className="auth-ledger-card" aria-label="RentFlow workspace preview">
          <div className="auth-ledger-top">
            <div><span>September collection</span><strong>₹0</strong></div>
            <span className="auth-status">Ready</span>
          </div>
          <div className="auth-ledger-grid">
            <div><span>Properties</span><strong>0</strong></div>
            <div><span>Occupied rooms</span><strong>0</strong></div>
            <div><span>Outstanding</span><strong>₹0</strong></div>
          </div>
          <div className="auth-ledger-empty">
            <Building2 aria-hidden="true" />
            <div><strong>Your first property starts here</strong><span>Each landlord receives an isolated workspace.</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthBrand() {
  return (
    <header className="auth-brand">
      <Link href="/" aria-label="RentFlow home"><span className="auth-brand-mark"><Building2 aria-hidden="true" /></span><span>RentFlow</span></Link>
      <span><Mail aria-hidden="true" /> Secure landlord access</span>
    </header>
  );
}
