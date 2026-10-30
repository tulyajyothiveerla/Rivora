import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in | RIVORA" };
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" href="/">RIVORA<span className="wordmark-period">.</span></Link>
      <div className="auth-wrap">
        <div className="auth-aside">
          <p className="eyebrow eyebrow-light">WELCOME BACK</p>
          <h1>Your car care,<br /><em>all in one place.</em></h1>
          <p>See what&apos;s coming up, manage your membership and stay in step with your RIVORA team.</p>
          <span className="auth-aside-mark"><KeyRound size={25} /></span>
        </div>
        <section className="auth-card">
          <p className="eyebrow eyebrow-muted">YOUR RIVORA ACCOUNT</p>
          <h2>Sign in</h2>
          <p className="auth-subtitle">Use your email and password to continue.</p>
          <AuthForm mode="login" next={next} />
          <p className="auth-switch">New to RIVORA? <Link href="/register">Create an account <span>→</span></Link></p>
          <Link className="auth-home-link" href="/">Back to the RIVORA website</Link>
        </section>
      </div>
    </main>
  );
}
