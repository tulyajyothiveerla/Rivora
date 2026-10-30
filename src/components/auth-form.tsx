"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register"; next?: string };

export default function AuthForm({ mode, next }: Props) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "We couldn't complete that request.");
        setPending(false);
        return;
      }
      if (mode === "register" && result.verificationRequired === true) {
        setVerificationEmail(String(result.email ?? values.email));
        setMessage(String(result.message ?? "Enter the verification code sent to your email."));
        setPending(false);
        return;
      }
      const safeNext = next?.startsWith("/portal") ? next : "/portal";
      router.replace(safeNext);
      router.refresh();
    } catch {
      setMessage("We couldn't connect just now. Please try again.");
      setPending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const code = new FormData(event.currentTarget).get("code");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail, code }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Email verification could not be completed.");
        setPending(false);
        return;
      }
      router.replace("/portal");
      router.refresh();
    } catch {
      setMessage("We couldn't connect just now. Please try again.");
      setPending(false);
    }
  }

  async function resendCode() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const result = await response.json();
      setMessage(result.message ?? result.error ?? "A new verification code was requested.");
    } catch {
      setMessage("We couldn't connect just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (verificationEmail) {
    return <form className="auth-form" onSubmit={verify}>
      <p className="verification-email">A six-digit code was sent to <strong>{verificationEmail}</strong>.</p>
      <label>Email verification code
        <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
          required minLength={6} maxLength={6} pattern="[0-9]{6}" placeholder="000000" />
      </label>
      <p className="auth-error" role="alert">{message}</p>
      <button className="button button-dark auth-submit" type="submit" disabled={pending}>
        {pending ? <>Please wait <LoaderCircle className="spin" size={16} /></> : <>Verify email <ArrowRight size={16} /></>}
      </button>
      <button className="text-action" type="button" onClick={() => void resendCode()} disabled={pending}>Send a new code</button>
      <button className="text-action" type="button" onClick={() => { setVerificationEmail(""); setMessage(""); }}>Use another email</button>
    </form>;
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && (
        <>
          <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Your full name" /></label>
          <label>Phone number <span className="optional-label">OPTIONAL</span><input name="phone" autoComplete="tel" maxLength={30} placeholder="+91" /></label>
          <label>City<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} placeholder="Your city" /></label>
          <label>Community or apartment <span className="optional-label">OPTIONAL</span><input name="communityRequest" maxLength={120} placeholder="Where you park" /></label>
        </>
      )}
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
      <label>Password
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
          required minLength={mode === "register" ? 12 : 1} maxLength={72}
          placeholder={mode === "register" ? "12-72 characters" : "Your password"} />
      </label>
      <p className="auth-error" role="alert">{message}</p>
      <button className="button button-dark auth-submit" type="submit" disabled={pending}>
        {pending ? <>Please wait <LoaderCircle className="spin" size={16} /></> :
          <>{mode === "login" ? "Sign in" : "Create my account"} <ArrowRight size={16} /></>}
      </button>
    </form>
  );
}
