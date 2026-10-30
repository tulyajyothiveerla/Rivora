import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = { title: "Create an account | RIVORA" };

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" href="/">RIVORA<span className="wordmark-period">.</span></Link>
      <div className="auth-wrap">
        <div className="auth-aside">
          <p className="eyebrow eyebrow-light">A GOOD PLACE TO START</p>
          <h1>Welcome to<br /><em>your next drive.</em></h1>
          <p>Create your account once. Your permanent RIVORA member ID stays with you through vehicles and renewals.</p>
          <span className="auth-aside-mark">01 <i /> RIVORA MEMBERS</span>
        </div>
        <section className="auth-card">
          <p className="eyebrow eyebrow-muted">JOIN RIVORA</p>
          <h2>Create your account</h2>
          <p className="auth-subtitle">Your member ID is created when you join.</p>
          <AuthForm mode="register" />
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in <span>→</span></Link></p>
          <p className="auth-privacy-note">Community membership is verified separately before community-only features are enabled.</p>
        </section>
      </div>
    </main>
  );
}
