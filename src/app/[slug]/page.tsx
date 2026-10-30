import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CarFront, Check, CircleHelp, MapPin, ShieldCheck, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import AvailabilityForm from "@/components/availability-form";
import { PublicPageLayout } from "@/components/public-page";

const pages: Record<string, { title: string; eyebrow: string; lead: string }> = {
  services: {
    title: "Care that fits into your everyday.",
    eyebrow: "THOUGHTFUL CAR CARE",
    lead: "A considered approach to your vehicle, coordinated around the community you call home.",
  },
  plans: {
    title: "A little care goes a long way.",
    eyebrow: "MEMBERSHIP, MADE PERSONAL",
    lead: "Discover the RIVORA membership levels. Availability, benefits and pricing are confirmed for each community before enrollment.",
  },
  "how-it-works": {
    title: "A good routine, made simple.",
    eyebrow: "HOW RIVORA WORKS",
    lead: "From the first enquiry to a completed service, every step is connected to the team looking after your car.",
  },
  availability: {
    title: "Good care starts close to home.",
    eyebrow: "COMMUNITY AVAILABILITY",
    lead: "Tell us where you park. Our team will follow up about service coverage and community availability.",
  },
  about: {
    title: "A cleaner drive. A calmer every day.",
    eyebrow: "ABOUT RIVORA",
    lead: "We believe good car care can feel thoughtful, reliable and right at home in your community.",
  },
  support: {
    title: "A little help goes a long way.",
    eyebrow: "HELP & CONTACT",
    lead: "Find a few answers below, or send our team an enquiry about service availability in your area.",
  },
  terms: {
    title: "Terms of use.",
    eyebrow: "INFORMATION",
    lead: "This product is being prepared for launch. Final terms must be reviewed and approved by RIVORA before customer transactions begin.",
  },
  privacy: {
    title: "Your privacy matters.",
    eyebrow: "INFORMATION",
    lead: "RIVORA is designed to keep personal account details private by default. This notice is a product summary, not a substitute for an approved privacy policy.",
  },
  cancellation: {
    title: "Plans should feel clear.",
    eyebrow: "INFORMATION",
    lead: "Cancellation, refund and renewal terms are not published until approved by RIVORA. Please contact the team before enrolling.",
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug];
  return { title: page ? `${page.title} | RIVORA` : "RIVORA" };
}

export default async function PublicSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) return <div className="public-not-found"><Link href="/">Return to RIVORA</Link></div>;
  return <PublicPageLayout eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
    {slug === "services" && <ServicesContent />}
    {slug === "plans" && <PlansContent />}
    {slug === "how-it-works" && <HowContent />}
    {slug === "availability" && <AvailabilityContent />}
    {slug === "about" && <AboutContent />}
    {slug === "support" && <SupportContent />}
    {["terms", "privacy", "cancellation"].includes(slug) && <LegalContent slug={slug} />}
  </PublicPageLayout>;
}

function ServicesContent() {
  const services = [
    { icon: Sparkles, title: "Exterior care", text: "A careful, regular clean that brings a little more shine back to your drive." },
    { icon: Check, title: "Interior refresh", text: "A considered cabin clean, carried out by trained professionals." },
    { icon: ShieldCheck, title: "Member assistance", text: "Plan-eligible tyre and service assistance when you need an extra hand." },
  ];
  return <><div className="public-feature-grid">{services.map(({ icon: Icon, title, text }, index) => <article className="public-feature-card" key={title}>
    <span className="public-feature-index">0{index + 1}</span><Icon size={21} /><h2>{title}</h2><p>{text}</p>
  </article>)}</div><p className="public-disclaimer">Specific services, products and benefit limits depend on the membership offered in your community. Your eligibility is confirmed before a service is booked.</p></>;
}

function PlansContent() {
  return <><div className="public-plan-grid">{[
    ["Discovery", "A thoughtful place to begin.", ["Explore availability", "Add a vehicle", "See what care is offered nearby"]],
    ["Signature", "A little more care in your routine.", ["Recurring car-care visits", "A dedicated service history", "RIVORA Club access when active"]],
    ["Privilege", "Our most considered ownership experience.", ["Enhanced care options", "Priority service coordination", "RIVORA Club access when active"]],
  ].map(([name, description, features], index) => <article className={`public-plan-card ${index === 1 ? "public-plan-featured" : ""}`} key={String(name)}>
    <p className="eyebrow eyebrow-muted">0{index + 1} / RIVORA MEMBERSHIP</p><h2>{name}</h2><p>{description}</p><ul>{(features as string[]).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
    <Link href="/availability">Ask about this plan <span>→</span></Link>
  </article>)}</div><p className="public-disclaimer">Prices, taxes, renewal rules and final benefits are still subject to confirmation. No membership becomes active until payment has been verified by RIVORA.</p></>;
}

function HowContent() {
  const steps: [LucideIcon, string, string][] = [
    [MapPin, "Find your community", "Send us your city and community. Our team checks coverage and local service capacity."],
    [Sparkles, "Choose a considered plan", "Explore only the plans and services available in your area, with clear benefit details."],
    [CarFront, "Add your vehicle", "Create your RIVORA account and keep your vehicle and service history together."],
    [CalendarDays, "Reserve a service", "See eligible services and times. A booking is confirmed only when real capacity is reserved."],
  ];
  return <div className="public-steps">{steps.map(([Icon, title, text], index) =>
    <article key={title}><span>0{index + 1}</span><Icon size={20} /><div><h2>{title}</h2><p>{text}</p></div></article>)}</div>;
}

function AvailabilityContent() {
  return <div className="availability-shell public-availability-shell">
    <div className="availability-copy"><p className="eyebrow eyebrow-light">A NOTE FOR OUR TEAM</p><h2>Tell us where<br /><em>you call home.</em></h2>
      <p>We&apos;ll get back to you with the coverage and next steps for your neighbourhood.</p>
      <div className="availability-note"><MapPin size={17} /> This enquiry does not reserve a service.</div></div>
    <AvailabilityForm />
  </div>;
}

function AboutContent() {
  return <div className="public-story">
    <span className="story-symbol"><UsersRound size={23} /></span>
    <div><p className="eyebrow eyebrow-muted">OUR POINT OF VIEW</p><h2>Care can be convenient without feeling hurried.</h2>
      <p>RIVORA brings car care closer to home, with professional service, clear coordination and respect for the communities where people live.</p>
      <p>One account keeps the details connected—from your member ID and vehicles to service history, support and membership. Our operations team sees the same reliable records you do.</p>
      <Link href="/how-it-works">See how RIVORA works <span>→</span></Link></div>
  </div>;
}

function SupportContent() {
  return <div className="faq-layout"><div className="faq-list">{[
    ["How do I know if RIVORA serves my community?", "Send an availability enquiry with your city and community. A submitted enquiry is not a confirmed booking."],
    ["When is my service actually booked?", "When you choose an eligible service and the system confirms capacity for your verified community, the visit is reserved in your account."],
    ["When does a membership become active?", "After RIVORA verifies the payment. A pending request or payment reference alone does not activate access."],
    ["What happens to my RIVORA Club access when a plan expires?", "Club actions are limited to active qualifying memberships. Billing, support and renewal information stay available."],
    ["Can I share my apartment or phone number with Club members?", "Those details are private by default and are not displayed in the Club feed."],
  ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
    <aside className="faq-contact"><CircleHelpIcon /><p className="eyebrow eyebrow-muted">A REAL PERSON, PLEASE</p><h2>Still have a question?</h2><p>Send our team a note and we&apos;ll get back to you about availability and next steps.</p><Link href="/availability">Contact the RIVORA team <span>→</span></Link></aside>
  </div>;
}

function LegalContent({ slug }: { slug: string }) {
  const text = slug === "privacy"
    ? ["Account details, apartment information and phone numbers are private by default. Residential community membership is verified by authorised operations staff.", "Club posts have audience controls. Active membership is required to view, post, react or message in the Club. Expired access is suspended; blocks and moderation decisions are retained.", "Service enquiries and customer actions create records so the RIVORA operations team can follow up. Data retention, deletion requests, hosting locations and contact details must be confirmed in the final privacy policy."]
    : slug === "cancellation"
      ? ["Do not publish or sell a membership until the final cancellation and refund policy has been approved.", "A pending payment is not a confirmed membership. A confirmed payment is reconciled before subscription access changes.", "For account help, submit a support request or an availability enquiry while RIVORA completes its approved policy."]
      : ["RIVORA account access is personal and must not be shared. Staff permissions are role-based and sensitive administrative actions are recorded.", "Service availability, plan details and membership benefits are community-specific and must be confirmed before a purchase or booking.", "Marketplace listings and member-to-member requests are subject to operations review and community guidelines. The final legal and transaction terms must be approved before marketplace release."];
  return <div className="legal-draft"><span className="legal-draft-label">PRE-LAUNCH INFORMATION · FINAL POLICY REQUIRES RIVORA APPROVAL</span>
    {text.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    <p>These notes explain current product behaviour and are not a final legal policy, offer or contractual promise.</p></div>;
}

function CircleHelpIcon() {
  return <CircleHelp size={22} />;
}
