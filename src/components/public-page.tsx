import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function PublicHeader() {
  return <header className="site-header">
    <Link className="wordmark" href="/" aria-label="RIVORA home">RIVORA<span className="wordmark-period">.</span></Link>
    <nav className="desktop-nav" aria-label="Main navigation">
      <Link href="/services">Services</Link><Link href="/how-it-works">How it works</Link>
      <Link href="/plans">Membership</Link><Link href="/support">Support</Link>
    </nav>
    <Link className="button public-member-link" href="/login">Sign in</Link>
    <Link className="button button-dark header-cta" href="/register">Join RIVORA <ArrowUpRight size={15} /></Link>
    <Link className="mobile-cta" href="/login" aria-label="Sign in"><ArrowUpRight size={19} /></Link>
  </header>;
}

export function PublicFooter() {
  return <footer className="site-footer">
    <div className="footer-main page-shell">
      <div className="footer-brand"><Link className="wordmark wordmark-light" href="/">RIVORA<span className="wordmark-period">.</span></Link>
        <p>A cleaner drive, for a better every day.</p></div>
      <div className="footer-nav">
        <div><span>DISCOVER</span><Link href="/services">Services</Link><Link href="/plans">Membership</Link><Link href="/how-it-works">How it works</Link></div>
        <div><span>HERE TO HELP</span><Link href="/support">FAQs & contact</Link><Link href="/availability">Check availability</Link><Link href="/login">My RIVORA</Link></div>
        <div><span>INFORMATION</span><Link href="/privacy">Privacy notice</Link><Link href="/terms">Terms</Link><Link href="/cancellation">Cancellations</Link></div>
      </div>
      <Link className="back-top" href="/">BACK TO RIVORA <ArrowUpRight size={14} /></Link>
    </div>
    <div className="footer-bottom page-shell"><span>© RIVORA. All rights reserved.</span><span>Thoughtfully made for the road ahead.</span></div>
  </footer>;
}

export function PublicPageLayout({ eyebrow, title, lead, children }: {
  eyebrow: string; title: React.ReactNode; lead: string; children: React.ReactNode;
}) {
  return <main className="public-page">
    <PublicHeader />
    <section className="public-page-hero"><div className="page-shell">
      <p className="eyebrow eyebrow-muted">{eyebrow}</p><h1>{title}</h1><p>{lead}</p>
    </div></section>
    <div className="public-page-content page-shell">{children}</div>
    <div className="public-page-cta"><div className="page-shell"><div><p className="eyebrow eyebrow-light">A GOOD PLACE TO START</p><h2>See if RIVORA is in your community.</h2></div>
      <Link className="button button-dark" href="/availability">Check availability <ArrowRight size={15} /></Link></div></div>
    <PublicFooter />
  </main>;
}
