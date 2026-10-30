import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WashingMachine,
} from "lucide-react";
import AvailabilityForm from "@/components/availability-form";
import Link from "next/link";

const services = [
  {
    number: "01",
    icon: WashingMachine,
    title: "A considered clean",
    description:
      "Thoughtful exterior and interior care, delivered by trained professionals who treat every vehicle with respect.",
    label: "THE EVERYDAY RESET",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Care that keeps up",
    description:
      "A recurring rhythm for your car, planned around the way you live and the community you call home.",
    label: "MADE TO FIT YOUR ROUTINE",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "People you can trust",
    description:
      "A consistent team, clear service updates and a considered approach to the spaces we work in.",
    label: "THE RIVORA STANDARD",
  },
];

const plans = [
  {
    name: "Discovery",
    descriptor: "A thoughtful place to begin.",
    features: ["Explore available care", "Find your community", "A plan shaped around your car"],
    style: "plan-card",
  },
  {
    name: "Signature",
    descriptor: "A little more care, built into your routine.",
    features: ["Recurring car-care visits", "A dedicated service history", "Access to RIVORA Club"],
    style: "plan-card plan-card-featured",
  },
  {
    name: "Privilege",
    descriptor: "Our most considered ownership experience.",
    features: ["Enhanced care options", "Priority service coordination", "Access to RIVORA Club"],
    style: "plan-card",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#home" aria-label="RIVORA home">
          RIVORA<span className="wordmark-period">.</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/services">Services</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/plans">Membership</Link>
          <Link href="/support">Support</Link>
        </nav>
        <Link className="button public-member-link" href="/login">Sign in</Link>
        <Link className="button button-dark header-cta" href="/register">
          Join RIVORA <ArrowUpRight size={15} strokeWidth={1.7} />
        </Link>
        <Link className="mobile-cta" href="/login" aria-label="Sign in">
          <ArrowUpRight size={19} />
        </Link>
      </header>

      <section className="hero" id="home">
        <div className="hero-image" role="img" aria-label="A premium car outside a modern residence" />
        <div className="hero-wash" />
        <div className="hero-content page-shell">
          <p className="eyebrow"><span /> PREMIUM CAR CARE, REIMAGINED</p>
          <h1>A cleaner drive.<br />A calmer every day.</h1>
          <p className="hero-copy">
            Thoughtful car care, brought to your community. So your car is ready
            for wherever life takes you.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#availability">
              Find your community <ArrowRight size={16} strokeWidth={1.7} />
            </a>
            <a className="text-link" href="#approach">
              Discover RIVORA <ArrowDown size={15} strokeWidth={1.7} />
            </a>
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            CAR CARE, WITH A LITTLE MORE CARE.
          </div>
        </div>
        <div className="hero-index"><span>01</span><i /> 03</div>
        <a className="scroll-cue" href="#services" aria-label="Scroll to services">
          <ArrowDown size={15} />
        </a>
      </section>

      <section className="promise-strip" aria-label="The RIVORA difference">
        <div className="promise-item"><UsersRound /><span>People-first<br />professionals</span></div>
        <span className="promise-divider" />
        <div className="promise-item"><Leaf /><span>Thoughtful<br />products</span></div>
        <span className="promise-divider" />
        <div className="promise-item"><MapPin /><span>Made for<br />your community</span></div>
        <span className="promise-divider" />
        <div className="promise-item"><CalendarDays /><span>Care on<br />your schedule</span></div>
      </section>

      <section className="section services-section page-shell" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow eyebrow-muted">THE RIVORA EXPERIENCE</p>
            <h2>Good care should<br /><em>feel effortless.</em></h2>
          </div>
          <p className="section-intro">
            The best kind of service is the kind that fits into your life
            quietly—and leaves your car feeling like itself again.
          </p>
        </div>
        <div className="service-grid">
          {services.map(({ number, icon: Icon, title, description, label }) => (
            <article className="service-card" key={number}>
              <div className="service-card-top">
                <span className="service-number">{number} / 03</span>
                <Icon size={21} strokeWidth={1.4} />
              </div>
              <p className="card-label">{label}</p>
              <h3>{title}</h3>
              <p className="service-description">{description}</p>
              <a className="circle-link" href="#availability" aria-label={`Ask about ${title}`}>
                <ArrowUpRight size={17} strokeWidth={1.5} />
              </a>
            </article>
          ))}
        </div>
        <p className="fine-print">
          Services and schedules depend on your plan and community availability.
        </p>
      </section>

      <section className="approach-section" id="approach">
        <div className="approach-ornament" aria-hidden="true">R.</div>
        <div className="approach-inner page-shell">
          <div className="approach-copy">
            <p className="eyebrow eyebrow-light">A BETTER KIND OF CAR CARE</p>
            <h2>More time for<br /><em>the road ahead.</em></h2>
            <p>
              Your day is already full. We bring considered car care closer to
              home, with people and processes you can feel good about.
            </p>
            <a className="light-link" href="#availability">
              See if we&apos;re in your community <ArrowRight size={16} />
            </a>
          </div>
          <div className="steps">
            <article className="step">
              <span className="step-index">01</span>
              <div><h3>Find your place</h3><p>Tell us where you park. We&apos;ll let you know what&apos;s available nearby.</p></div>
              <MapPin size={19} />
            </article>
            <article className="step">
              <span className="step-index">02</span>
              <div><h3>Choose your rhythm</h3><p>Explore a membership shaped around your vehicle and your routine.</p></div>
              <Clock3 size={19} />
            </article>
            <article className="step">
              <span className="step-index">03</span>
              <div><h3>Leave the rest to us</h3><p>Your service is coordinated by our team, right in your community.</p></div>
              <Check size={19} />
            </article>
          </div>
        </div>
      </section>

      <section className="section plans-section page-shell" id="plans">
        <div className="plans-heading">
          <p className="eyebrow eyebrow-muted">MEMBERSHIP, MADE PERSONAL</p>
          <h2>A little care goes<br /><em>a long way.</em></h2>
          <p>Three ways to make good car care part of your everyday.</p>
        </div>
        <div className="plan-grid">
          {plans.map((plan, index) => (
            <article className={plan.style} key={plan.name}>
              <div className="plan-topline"><span>0{index + 1}</span><span>RIVORA MEMBERSHIP</span></div>
              <h3>{plan.name}</h3>
              <p className="plan-descriptor">{plan.descriptor}</p>
              <span className="plan-rule" />
              <ul>{plan.features.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
              <a className="plan-link" href="#availability">Ask about {plan.name}<ArrowRight size={15} /></a>
            </article>
          ))}
        </div>
        <p className="fine-print plan-note">
          Plan details, service eligibility and availability vary by community.
          We&apos;ll share what&apos;s currently offered in your area.
        </p>
      </section>

      <section className="availability-section" id="availability">
        <div className="availability-shell page-shell">
          <div className="availability-copy">
            <p className="eyebrow eyebrow-light">A GOOD PLACE TO START</p>
            <h2>Is RIVORA<br /><em>near you?</em></h2>
            <p>
              We&apos;re bringing thoughtful car care to communities one
              neighbourhood at a time. Leave us a note and our team will be in touch.
            </p>
            <div className="availability-note"><MapPin size={17} /> Currently expanding across select communities</div>
          </div>
          <AvailabilityForm />
        </div>
      </section>

      <section className="club-section page-shell" id="about">
        <div className="club-mark"><span>R</span><i /></div>
        <div className="club-copy">
          <p className="eyebrow eyebrow-muted">A LITTLE MORE, FOR MEMBERS</p>
          <h2>Meet you at<br /><em>RIVORA Club.</em></h2>
          <p>
            A quieter corner for people who care about the drive as much as the
            destination. Club access is available with select active memberships.
          </p>
        </div>
        <a className="club-link" href="#plans">Explore memberships <ArrowUpRight size={16} /></a>
      </section>

      <footer className="site-footer">
        <div className="footer-main page-shell">
          <div className="footer-brand">
            <a className="wordmark wordmark-light" href="#home">RIVORA<span className="wordmark-period">.</span></a>
            <p>A cleaner drive, for a better every day.</p>
          </div>
          <div className="footer-nav">
            <div><span>EXPLORE</span><Link href="/services">Our services</Link><Link href="/how-it-works">How it works</Link><Link href="/plans">Membership</Link></div>
            <div><span>GET IN TOUCH</span><Link href="/availability">Check availability</Link><Link href="/support">Help & contact</Link><Link href="/login">My RIVORA</Link></div>
            <div><span>INFORMATION</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation">Cancellations</Link></div>
          </div>
          <Link className="back-top" href="/">BACK TO TOP <ArrowUpRight size={14} /></Link>
        </div>
        <div className="footer-bottom page-shell">
          <span>© RIVORA. All rights reserved.</span>
          <span>Thoughtfully made for the road ahead.</span>
        </div>
      </footer>
    </main>
  );
}
