"use client";

import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  CarFront, Check, ChevronDown, CircleHelp, Clock3, CreditCard, Gauge,
  Heart, LayoutDashboard, Leaf, ListChecks, LogOut, MapPin, MessageCircle,
  Plus, Settings, ShieldCheck, ShieldQuestion, Sparkles, UsersRound, Wallet,
  WashingMachine, Wrench, X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

type Row = Record<string, unknown>;

type NavItem = { id: string; label: string; icon: typeof Gauge; group?: string };

const customerNav: NavItem[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "vehicles", label: "My vehicles", icon: CarFront, group: "MY CAR CARE" },
  { id: "membership", label: "My membership", icon: ShieldCheck },
  { id: "services", label: "Book a service", icon: CalendarDays },
  { id: "bookings", label: "Bookings & schedule", icon: Clock3 },
  { id: "history", label: "Service history", icon: ListChecks },
  { id: "payments", label: "Payments & invoices", icon: CreditCard },
  { id: "support", label: "Assistance & support", icon: CircleHelp },
  { id: "club", label: "RIVORA Club", icon: Heart, group: "YOUR COMMUNITY" },
  { id: "parking", label: "Parking marketplace", icon: MapPin },
  { id: "cars", label: "Buy & sell cars", icon: CarFront },
  { id: "myParking", label: "My parking listings", icon: MapPin },
  { id: "myBids", label: "My parking bids", icon: Activity },
  { id: "parkingIncomingBids", label: "Bids on my spaces", icon: Wallet },
  { id: "myCars", label: "My car listings", icon: CarFront },
  { id: "savedCars", label: "Saved cars", icon: Heart },
  { id: "rentalRequests", label: "My parking rentals", icon: CalendarDays },
  { id: "carEnquiries", label: "My car enquiries", icon: MessageCircle },
  { id: "notifications", label: "Notifications", icon: Bell, group: "ACCOUNT" },
  { id: "profile", label: "Profile & settings", icon: UsersRound },
];

const workerNav: NavItem[] = [
  { id: "dashboard", label: "Today's overview", icon: LayoutDashboard },
  { id: "jobs", label: "My assignments", icon: ListChecks, group: "FIELD OPERATIONS" },
  { id: "attendance", label: "Attendance", icon: Clock3 },
  { id: "profile", label: "My profile", icon: UsersRound },
];

const adminNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "operations", label: "Bookings & schedule", icon: CalendarDays, group: "OPERATIONS" },
  { id: "customers", label: "Customers & members", icon: UsersRound },
  { id: "subscriptions", label: "Subscriptions", icon: ShieldCheck },
  { id: "plans", label: "Plans & services", icon: Sparkles },
  { id: "teams", label: "Employees & teams", icon: Wrench },
  { id: "communities", label: "Communities", icon: MapPin },
  { id: "support", label: "Service requests", icon: CircleHelp },
  { id: "inquiries", label: "Public enquiries", icon: MessageCircle },
  { id: "finance", label: "Payments & finance", icon: Wallet },
  { id: "moderation", label: "Club moderation", icon: ShieldQuestion, group: "MEMBER EXPERIENCE" },
  { id: "parkingManage", label: "Parking management", icon: MapPin },
  { id: "carListings", label: "Car marketplace", icon: CarFront },
  { id: "carEnquiryManagement", label: "Car enquiries", icon: MessageCircle },
  { id: "rentalManagement", label: "Rental requests", icon: CalendarDays },
  { id: "reports", label: "Reports & analytics", icon: Activity, group: "INSIGHTS" },
  { id: "attendance", label: "Attendance", icon: Clock3 },
  { id: "audit", label: "Audit log", icon: ListChecks },
  { id: "settings", label: "Settings & access", icon: Settings, group: "CONFIGURATION" },
];

const pageTitles: Record<string, string> = {
  dashboard: "A good day starts here.", profile: "Your account, your way.",
  vehicles: "Every car, considered.", membership: "Your RIVORA membership.",
  services: "Care, on your schedule.", bookings: "The next visit, all set.",
  history: "A little history of good care.", payments: "Your payment history.",
  support: "We're here to help.", notifications: "A note from your RIVORA team.",
  club: "The road is better together.", parking: "A little more room.",
  cars: "A good drive finds a new home.", carEnquiries: "Your marketplace conversations.",
  jobs: "Your service assignments.", attendance: "Your field schedule.",
  operations: "The day, at a glance.", customers: "The people behind every drive.",
  subscriptions: "Memberships, in good order.", plans: "The RIVORA offering.",
  teams: "The people who make it happen.", communities: "Where good care begins.",
  finance: "Every detail, accounted for.", inquiries: "Every enquiry, thoughtfully followed up.",
  moderation: "A thoughtful community starts here.",
  reports: "A clearer view of the work.", audit: "The work behind the work.",
  parkingManage: "Parking, at a glance.", carListings: "Listings and enquiries.",
  parkingIncomingBids: "Bids for your community space.",
  rentalManagement: "Rental requests.",
  settings: "A thoughtful platform, configured.",
};

const staffScopes = [
  ["OPERATIONS", "Bookings, plans and service scheduling"],
  ["CUSTOMERS", "Customer accounts and community verification"],
  ["TEAM_MANAGEMENT", "Staff accounts and team access"],
  ["COMMUNITIES", "Community setup and capacity"],
  ["SUPPORT", "Customer support and public enquiries"],
  ["FINANCE", "Payment reconciliation"],
  ["MARKETPLACE", "Parking and car marketplace review"],
  ["MODERATION", "RIVORA Club reports and moderation"],
  ["REPORTS", "Business and service reports"],
  ["AUDIT", "Audit history"],
] as const;

const moneyKeys = new Set(["priceMinor", "amountMinor", "revenueMinor"]);
const hiddenKeys = new Set(["id", "vehicleId", "serviceId", "slotId", "subscriptionId", "workerId", "communityId", "bookingId", "listingId", "postId", "targetId", "actorId", "reviewedBy", "memberId", "ownerId", "userId"]);

export default function PortalApp({ user }: { user: SessionUser }) {
  const router = useRouter();
  const nav = useMemo(() => {
    if (user.role === "ADMIN") return adminNav;
    if (user.role === "CUSTOMER") return customerNav;
    const extra = staffScopes.flatMap(([scope, label]) => user.permissions?.includes(scope) ? [{
      id: `staff-${scope}`, label, icon: ShieldCheck, group: "ADDITIONAL ACCESS",
    }] : []);
    const viewByScope: Record<string, string> = {
      OPERATIONS: "operations", CUSTOMERS: "customers", TEAM_MANAGEMENT: "teams",
      COMMUNITIES: "communities", SUPPORT: "support", FINANCE: "finance",
      MARKETPLACE: "parkingManage", MODERATION: "moderation", REPORTS: "reports", AUDIT: "audit",
    };
    return [...workerNav, ...extra.map((entry) => ({ ...entry, id: viewByScope[entry.id.slice(6)] ?? entry.id }))];
  }, [user.role, user.permissions]);
  const [active, setActive] = useState("dashboard");
  const [data, setData] = useState<unknown>(null);
  const [catalog, setCatalog] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [communities, setCommunities] = useState<Row[]>([]);
  const [workers, setWorkers] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (view = active) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/portal?view=${encodeURIComponent(view)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "This section couldn't be loaded.");
        setData(null);
        setLoading(false);
        return;
      }
      setData(result.data);

      if (view === "membership") {
        const [plansResponse, paymentsResponse] = await Promise.all([
          fetch("/api/portal?view=catalog", { cache: "no-store" }),
          fetch("/api/portal?view=payments", { cache: "no-store" }),
        ]);
        if (plansResponse.ok) setCatalog((await plansResponse.json()).data ?? []);
        if (paymentsResponse.ok) {
          const paymentRows = (await paymentsResponse.json()).data as Row[];
          setPayments(paymentRows);
        }
      }
      if (view === "vehicles" || view === "services") {
        const responseVehicles = await fetch("/api/portal?view=vehicles", { cache: "no-store" });
        if (responseVehicles.ok) setVehicles((await responseVehicles.json()).data ?? []);
      }
      if (["operations", "services", "communities", "customers", "plans"].includes(view)) {
        const [communityResponse, serviceResponse] = await Promise.all([
          fetch("/api/portal?view=communities", { cache: "no-store" }),
          fetch("/api/portal?view=serviceCatalog", { cache: "no-store" }),
        ]);
        if (communityResponse.ok) setCommunities((await communityResponse.json()).data ?? []);
        if (serviceResponse.ok) setServices((await serviceResponse.json()).data ?? []);
      }
      if (view === "operations") {
        const responseWorkers = await fetch("/api/portal?view=teams", { cache: "no-store" });
        if (responseWorkers.ok) setWorkers((await responseWorkers.json()).data ?? []);
      }
      setLoading(false);
    } catch {
      setError("We couldn't connect to the RIVORA service. Please try again.");
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(active); }, 0);
    return () => window.clearTimeout(timer);
  }, [active, load]);

  async function act(action: string, values: Row, success: string) {
    setError("");
    setNotice("");
    const response = await fetch("/api/portal/actions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...values }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "That action couldn't be completed.");
      return false;
    }
    setNotice(result.message ?? success);
    await load(active);
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: string, success: string, extra: Row = {}) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries()) as Row;
    for (const key of ["startsAt", "endsAt"]) {
      if (typeof values[key] === "string" && values[key]) {
        const timestamp = new Date(values[key] as string);
        if (Number.isNaN(timestamp.getTime())) {
          setError("Please enter valid service window times.");
          return;
        }
        values[key] = timestamp.toISOString();
      }
    }
    for (const key of ["clubAccess", "published", "active", "saved"]) {
      if (key in values) values[key] = values[key] === "on";
    }
    if ("priceMinor" in values && values.priceMinor === "") values.priceMinor = null;
    const done = await act(action, { ...values, ...extra }, success);
    if (done && !extra.keepForm) form.reset();
  }

  async function signOut() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      setError("We couldn't sign you out. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const rows = Array.isArray(data) ? data as Row[] : [];
  const filteredRows = rows.filter((row) => !query || Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()));
  const stats = data && !Array.isArray(data) ? data as Row : {};
  const item = nav.find((entry) => entry.id === active);

  return (
    <div className="portal-frame">
      <aside className={`portal-sidebar ${mobileMenu ? "portal-sidebar-open" : ""}`}>
        <div className="portal-brand-row">
          <Link href="/" className="wordmark portal-wordmark">RIVORA<span className="wordmark-period">.</span></Link>
          <button className="sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="portal-side-caption">
          <span>{user.role === "ADMIN" ? "OPERATIONS" : user.role === "WORKER" ? "FIELD TEAM" : "MY CAR CARE"}</span>
          <i />
        </div>
        <nav className="portal-nav" aria-label="Portal navigation">
          {nav.map((entry) => {
            const Icon = entry.icon;
            return <div key={entry.id}>
              {entry.group && <p className="portal-nav-group">{entry.group}</p>}
              <button className={`portal-nav-item ${active === entry.id ? "portal-nav-active" : ""}`}
                onClick={() => { setActive(entry.id); setQuery(""); setMobileMenu(false); }}>
                <Icon size={17} strokeWidth={1.7} /><span>{entry.label}</span>
                {entry.id === "notifications" && Number(stats.unreadNotifications) > 0 && <i />}
              </button>
            </div>;
          })}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="portal-member-mini"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.memberId}</small></div><ChevronDown size={14} /></div>
          <button className="portal-signout" onClick={signOut}><LogOut size={15} /> Sign out <ArrowUpRight size={13} /></button>
          <p>RIVORA · THOUGHTFUL CARE</p>
        </div>
      </aside>
      <main className="portal-main">
        <header className="portal-topbar">
          <button className="portal-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><LayoutDashboard size={19} /></button>
          <div className="portal-breadcrumb"><Link href="/">RIVORA</Link><span>/</span><span>{user.role === "ADMIN" ? "Operations" : user.role === "WORKER" ? "Field team" : "My car care"}</span></div>
          <div className="portal-top-actions">
            <span className="portal-role-chip">{user.role}</span>
            {user.role === "CUSTOMER" && <button className="portal-icon-button" onClick={() => setActive("notifications")} aria-label="Notifications"><Bell size={17} /></button>}
            <span className="portal-avatar">{initials(user.name)}</span>
          </div>
        </header>
        <div className="portal-content">
          <div className="portal-title-row">
            <div><p className="eyebrow eyebrow-muted">{item?.group ?? (user.role === "ADMIN" ? "RIVORA OPERATIONS" : user.role === "WORKER" ? "YOUR WORKSPACE" : "YOUR RIVORA")}</p>
              <h1>{pageTitles[active] ?? item?.label}</h1></div>
            <p className="portal-date"><CalendarDays size={15} /> {new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          </div>
          {error && <div className="portal-alert portal-alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
          {notice && <div className="portal-alert portal-alert-success" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
          {loading ? <div className="portal-loading"><span className="loading-dot" /> Preparing your workspace…</div> :
            active === "dashboard" ? <Dashboard user={user} stats={stats} onNavigate={setActive} /> :
            active === "profile" ? <ProfileView user={user} data={stats} onSubmit={submit} /> :
            <WorkspaceView active={active} payload={data} rows={filteredRows} rawRows={rows} query={query} setQuery={setQuery}
              user={user} catalog={catalog} payments={payments} services={services} vehicles={vehicles}
              communities={communities} workers={workers} onSubmit={submit} onAction={act} onReload={() => load(active)} />}
        </div>
      </main>
      {mobileMenu && <button className="portal-backdrop" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
    </div>
  );
}

function Dashboard({ user, stats, onNavigate }: { user: SessionUser; stats: Row; onNavigate: (view: string) => void }) {
  const customerMetrics = [
    ["Your vehicles", stats.vehicles ?? 0, CarFront, "vehicles"],
    ["Active memberships", stats.activeSubscriptions ?? 0, ShieldCheck, "membership"],
    ["Upcoming visits", stats.upcomingBookings ?? 0, CalendarDays, "bookings"],
    ["Open requests", stats.openTickets ?? 0, CircleHelp, "support"],
  ];
  const adminMetrics = [
    ["Customers", stats.customers ?? 0, UsersRound, "customers"],
    ["Active memberships", stats.activeSubscriptions ?? 0, ShieldCheck, "subscriptions"],
    ["Bookings to coordinate", stats.pendingBookings ?? 0, CalendarDays, "operations"],
    ["Open support", stats.openTickets ?? 0, CircleHelp, "support"],
    ["Reports to review", stats.openReports ?? 0, ShieldQuestion, "moderation"],
    ["Public enquiries", stats.openInquiries ?? 0, MessageCircle, "inquiries"],
    ["Revenue collected", stats.revenueMinor ?? 0, Wallet, "finance"],
    ["Completed today", stats.completedToday ?? 0, Check, "operations"],
  ];
  const workerMetrics = [
    ["Today's assignments", stats.activeJobs ?? 0, ListChecks, "jobs"],
    ["Completed today", stats.completedToday ?? 0, Check, "jobs"],
    ["Visits to follow up", stats.missedVisits ?? 0, CircleHelp, "jobs"],
  ];
  const metrics = user.role === "ADMIN" ? adminMetrics : user.role === "WORKER" ? workerMetrics : customerMetrics;

  return <div className="portal-dashboard">
    <section className="dashboard-welcome">
      <div><p className="eyebrow eyebrow-light">{user.role === "ADMIN" ? "TODAY AT RIVORA" : user.role === "WORKER" ? "READY WHEN YOU ARE" : "GOOD TO SEE YOU AGAIN"}</p>
        <h2>{greeting()}, {user.name.split(" ")[0]}.</h2>
        <p>{user.role === "ADMIN" ? "Here is the latest across your RIVORA operations." : user.role === "WORKER" ? "Your assignments and service notes are ready when you are." : "Your car care is in good hands. Here is what is coming up."}</p></div>
      <span className="welcome-emblem"><span>R</span><i /></span>
    </section>
    <div className={`metric-grid ${user.role === "ADMIN" ? "metric-grid-admin" : ""}`}>
      {metrics.map(([label, value, Icon, view]) => {
        const MetricIcon = Icon as typeof Gauge;
        return <button className="metric-card" key={String(label)} onClick={() => onNavigate(String(view))}>
          <span className="metric-icon"><MetricIcon size={17} /></span><span className="metric-label">{String(label)}</span>
          <strong>          {user.role === "ADMIN" && label === "Revenue collected" ? formatMoney(value, "INR") : String(value)}</strong>
          <span className="metric-link">View details <ArrowUpRight size={13} /></span>
        </button>;
      })}
    </div>
    <div className="dashboard-lower">
      <section className="dashboard-panel dashboard-next">
        <div className="panel-heading"><div><p className="eyebrow eyebrow-muted">{user.role === "ADMIN" ? "OPERATIONS SHORTCUTS" : user.role === "WORKER" ? "YOUR WORKDAY" : "YOUR RIVORA SHORTCUTS"}</p><h3>{user.role === "ADMIN" ? "A few things to keep moving." : user.role === "WORKER" ? "The details that matter." : "A little less to think about."}</h3></div><ArrowRight size={18} /></div>
        {(user.role === "ADMIN" ? [
          ["Coordinate today's visits", "Review bookings and assign the field team.", "operations", CalendarDays],
          ["Respond to customers", "Keep service requests moving.", "support", CircleHelp],
          ["Review the community", "Resolve member reports with care.", "moderation", ShieldQuestion],
        ] : user.role === "WORKER" ? [
          ["See today's jobs", "Check vehicle, location and service notes.", "jobs", ListChecks],
          ["Record attendance", "Keep your team's workday up to date.", "attendance", Clock3],
        ] : [
          ["Add another car", "Keep all your vehicles in one place.", "vehicles", CarFront],
          ["Find your next visit", "See what services and times are available.", "services", CalendarDays],
          ["Ask for a hand", "Send a request directly to our care team.", "support", CircleHelp],
        ]).map(([title, text, view, Icon]) => {
          const ShortcutIcon = Icon as typeof Gauge;
          return <button className="shortcut-row" key={String(view)} onClick={() => onNavigate(String(view))}>
            <span className="shortcut-icon"><ShortcutIcon size={17} /></span><span><strong>{String(title)}</strong><small>{String(text)}</small></span><ArrowUpRight size={15} />
          </button>;
        })}
      </section>
      <aside className="dashboard-panel dashboard-note">
        <span className="note-symbol"><Leaf size={20} /></span>
        <p className="eyebrow eyebrow-muted">{user.role === "ADMIN" ? "THE RIVORA STANDARD" : user.role === "WORKER" ? "THE RIVORA STANDARD" : "A NOTE FROM RIVORA"}</p>
        <h3>Good care is a little thing, done thoughtfully.</h3>
        <p>{user.role === "CUSTOMER" ? "Your permanent member ID follows you through every vehicle and renewal." : "Each update creates a shared record, keeping the work clear for everyone."}</p>
        {user.role === "CUSTOMER" && <span className="member-id">MEMBER ID <strong>{user.memberId}</strong></span>}
      </aside>
    </div>
  </div>;
}

function ProfileView({ user, data, onSubmit }: { user: SessionUser; data: Row; onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void }) {
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary">
      <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">YOUR DETAILS</p><h2>Profile & preferences</h2></div><span className="profile-member-id">{String(data.memberId ?? user.memberId)}</span></div>
      <form className="portal-form" onSubmit={(event) => onSubmit(event, "profile.update", "Your profile is up to date.")}>
        <label>Full name<input name="name" required minLength={2} maxLength={80} defaultValue={String(data.name ?? user.name)} /></label>
        <label>Email address<input type="email" value={String(data.email ?? user.email)} readOnly /></label>
        <label>Phone number<input name="phone" maxLength={30} defaultValue={String(data.phone ?? "")} placeholder="Add a phone number" /></label>
        <label>City<input name="city" required minLength={2} maxLength={80} defaultValue={String(data.city ?? "")} /></label>
        <label>Community or apartment name<input name="communityRequest" maxLength={120} defaultValue={String(data.communityRequest ?? "")} placeholder="Request community verification" /></label>
        <label>Apartment or parking location<input name="apartment" maxLength={80} defaultValue={String(data.apartment ?? "")} placeholder="Optional" /></label>
        <label>Verified community<input value={[data.communityName, data.communityCity].filter(Boolean).join(", ") || "Not yet verified"} readOnly /></label>
        <button className="portal-button portal-button-dark" type="submit">Save profile <ArrowRight size={15} /></button>
      </form>
    </section>
    <aside className="workspace-card workspace-aside"><ShieldCheck size={22} /><p className="eyebrow eyebrow-muted">PRIVATE BY DEFAULT</p><h3>Your details stay yours.</h3><p>Your name, apartment details and phone are shared only with authorised RIVORA operations staff for service delivery.</p></aside>
  </div>;
}

function WorkspaceView({
  active, payload, rows, rawRows, query, setQuery, user, catalog, payments, services, vehicles, communities, workers,
  onSubmit, onAction, onReload,
}: {
  active: string; payload: unknown; rows: Row[]; rawRows: Row[]; query: string; setQuery: (query: string) => void;
  user: SessionUser; catalog: Row[]; payments: Row[]; services: Row[]; vehicles: Row[]; communities: Row[];
  workers: Row[];
  onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string, extra?: Row) => void;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
  onReload: () => void;
}) {
  if (active === "membership") return <MembershipView rows={rawRows} plans={catalog} payments={payments} onAction={onAction} />;
  if (active === "services") return <BookingForm services={rawRows} vehicles={vehicles} onSubmit={onSubmit} />;
  if (active === "vehicles") return <VehiclesView rows={rows} onSubmit={onSubmit} />;
  if (active === "history" && user.role === "CUSTOMER") return <CustomerHistory rows={rows} />;
  if (active === "payments" && user.role === "CUSTOMER") return <CustomerPayments rows={rows} onAction={onAction} />;
  if (active === "support") return user.role === "ADMIN" ? <AdminSupport rows={rows} onAction={onAction} /> : <SupportView rows={rows} onSubmit={onSubmit} />;
  if (active === "jobs") return <JobsView rows={rows} onAction={onAction} />;
  if (active === "attendance") return <AttendanceView user={user} rows={rows} onAction={onAction} />;
  if (active === "operations") return <OperationsView rows={rows} services={services} communities={communities} workers={workers} onSubmit={onSubmit} onAction={onAction} />;
  if (active === "plans") return <PlansView rows={rows} services={services} onSubmit={onSubmit} onAction={onAction} />;
  if (active === "communities") return <CommunitiesView rows={rows} onSubmit={onSubmit} onReload={onReload} />;
  if (active === "customers") return <CustomersView rows={rows} communities={communities} onAction={onAction} />;
  if (active === "subscriptions") return <SubscriptionView rows={rows} onAction={onAction} />;
  if (active === "teams") return <TeamsView rows={rows} onAction={onAction} />;
  if (active === "moderation") return <ModerationView rows={rows} onAction={onAction} />;
  if (active === "inquiries") return <InquiriesView rows={rows} onAction={onAction} />;
  if (active === "club") return <ClubView data={payload as Row} user={user} onAction={onAction} />;
  if (active === "settings") return <SettingsView data={payload as Row} onAction={onAction} />;
  if (active === "parking" || active === "myParking" || active === "rentalRequests" || active === "myBids" || active === "parkingIncomingBids") return <ParkingView active={active} rows={rows} user={user} onAction={onAction} />;
  if (active === "cars" || active === "myCars" || active === "savedCars" || active === "carEnquiries") return <CarsView active={active} rows={rows} onAction={onAction} />;
  if (active === "notifications") return <NotificationsView rows={rows} onAction={onAction} />;
  const labels: Record<string, string> = {
    bookings: "Upcoming visits and service assignments", history: "Completed and previous services",
    payments: "Payments and receipts", reports: "Business performance and service trends",
    audit: "A time-stamped trail of sensitive operations",
    parkingManage: "Member-submitted parking listings awaiting operations review",
    carListings: "Car listings and marketplace content review",
    rentalManagement: "Parking rental requests and approvals",
    carEnquiries: "Enquiries you've sent or received",
    carEnquiryManagement: "Member enquiries about vehicle listings",
    inquiries: "Public availability and contact enquiries",
    myParking: "Listings you have shared with your community",
    myBids: "Your bids for spaces in your community",
    myCars: "Your cars listed in the marketplace",
    savedCars: "Cars you have saved for later",
    rentalRequests: "Your parking rentals and inbound requests",
  };
  if ((active === "payments" || active === "finance") && user.role === "ADMIN") return <FinanceView rows={rows} onAction={onAction} />;
  if (active === "parkingManage") return <ParkingAdmin rows={rows} onAction={onAction} />;
  if (active === "carListings") return <CarAdmin rows={rows} onAction={onAction} />;
  if (active === "rentalManagement") return <RentalView rows={rows} onAction={onAction} />;
  return <DataTable title={labels[active] ?? "RIVORA records"} rows={rows} filtered={rows} query={query} setQuery={setQuery} />;
}

function CustomerHistory({ rows }: { rows: Row[] }) {
  return <section className="workspace-card service-history">
    <div className="workspace-card-heading">
      <div><p className="eyebrow eyebrow-muted">YOUR SERVICE RECORD</p><h2>Completed and previous services</h2></div>
      <span className="data-count">{rows.length}</span>
    </div>
    {rows.length ? <div className="service-history-list">{rows.map((row) => {
      const proofUrls = Array.isArray(row.proofUrls)
        ? row.proofUrls.filter((url): url is string => typeof url === "string" &&
          (/^\/api\/portal\/media\/[0-9a-f-]{36}$/i.test(url) || /^https:\/\//i.test(url)))
        : [];
      return <article className="service-history-entry" key={String(row.id)}>
        <div className="service-history-heading">
          <div><p className="eyebrow eyebrow-muted">{String(row.serviceName)} · {String(row.registration)}</p>
            <h3>{String(row.make)} {String(row.model)}</h3></div>
          <Status value={row.status} />
        </div>
        <p className="service-history-meta">{formatDate(row.startsAt)} · {String(row.communityName)}</p>
        {Boolean(row.workerName) && <p className="service-history-meta">Service professional: {String(row.workerName)}</p>}
        {Boolean(row.completionNotes) && <p className="service-history-notes">{String(row.completionNotes)}</p>}
        {Boolean(row.issue) && <p className="service-history-notes">{String(row.issue)}</p>}
        {proofUrls.length > 0 && <div className="service-proof">
          <h4>Completion proof</h4>
          <div className="service-proof-grid">{proofUrls.map((url) =>
            url.startsWith("/api/portal/media/")
              ? <Image key={url} className="service-proof-image" src={url} alt="Service completion proof" width={640} height={400} unoptimized />
              : <a key={url} href={url} target="_blank" rel="noopener noreferrer">View service completion proof</a>,
          )}</div>
        </div>}
      </article>;
    })}</div> : <EmptyState icon={ListChecks} title="No previous services yet." text="Completed visits and service notes will be kept here." />}
  </section>;
}

function VehiclesView({ rows, onSubmit }: { rows: Row[]; onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void }) {
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary">
      <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">YOUR GARAGE</p><h2>Your vehicles <small>{rows.length}</small></h2></div><span className="workspace-icon"><CarFront /></span></div>
      {rows.length ? <div className="vehicle-grid">{rows.map((vehicle) => <article className="vehicle-card" key={String(vehicle.id)}>
        <span className="vehicle-icon"><CarFront size={22} /></span><p className="eyebrow eyebrow-muted">{String(vehicle.registration)}</p>
        <h3>{String(vehicle.make)} {String(vehicle.model)}</h3><p>{[vehicle.year, vehicle.color].filter(Boolean).map(String).join(" · ") || "Vehicle"}</p>
        {Boolean(vehicle.parkingLocation) && <span className="vehicle-location"><MapPin size={13} /> {String(vehicle.parkingLocation)}</span>}
      </article>)}</div> : <EmptyState icon={CarFront} title="No vehicles just yet." text="Add your car to make booking your next visit easier." />}
    </section>
    <section className="workspace-card workspace-aside">
      <p className="eyebrow eyebrow-muted">ADD A VEHICLE</p><h3>Keep your care in one place.</h3>
      <form className="portal-form" onSubmit={(event) => onSubmit(event, "vehicle.add", "Vehicle added to your garage.")}>
        <label>Make<input name="make" required maxLength={60} placeholder="e.g. Volvo" /></label>
        <label>Model<input name="model" required maxLength={80} placeholder="e.g. XC60" /></label>
        <label>Registration<input name="registration" required maxLength={20} placeholder="Vehicle registration" /></label>
        <div className="form-pair"><label>Year<input name="year" type="number" min="1950" max="2100" /></label><label>Colour<input name="color" maxLength={40} /></label></div>
        <label>Parking location<input name="parkingLocation" maxLength={120} placeholder="Optional" /></label>
        <button className="portal-button portal-button-dark" type="submit"><Plus size={15} /> Add vehicle</button>
      </form>
    </section>
  </div>;
}

function BookingForm({ services, vehicles, onSubmit }: { services: Row[]; vehicles: Row[]; onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void }) {
  const uniqueServices = [...new Map(services.map((service) => [String(service.serviceId), service])).values()];
  const [selectedService, setSelectedService] = useState("");
  const slots = services.filter((service) => !selectedService || service.serviceId === selectedService);
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary">
      <p className="eyebrow eyebrow-muted">YOUR AVAILABLE CARE</p><h2>Choose a service and time.</h2>
      {services.length ? <form className="portal-form" onSubmit={(event) => onSubmit(event, "booking.request", "Your service is confirmed and the slot is reserved.")}>
        <label>Your vehicle<select name="vehicleId" required defaultValue=""><option value="" disabled>Select a vehicle</option>
          {vehicles.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{String(vehicle.make)} {String(vehicle.model)} · {String(vehicle.registration)}</option>)}</select></label>
        <label>Service<select name="serviceId" required value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
          <option value="" disabled>Select an eligible service</option>
          {uniqueServices.map((service) => <option key={String(service.serviceId)} value={String(service.serviceId)}>{String(service.name)}</option>)}</select></label>
        <label>Available time<select name="slotId" required defaultValue=""><option value="" disabled>Select a service time</option>
          {slots.map((slot) => <option key={String(slot.slotId)} value={String(slot.slotId)}>
            {formatDate(slot.startsAt)} · {String(slot.communityName)} · {String(slot.remaining)} spaces
          </option>)}</select></label>
        <label>Notes for our team<textarea name="notes" rows={3} maxLength={500} placeholder="Parking instructions or helpful details" /></label>
        <p className="form-help"><ShieldCheck size={15} /> Eligibility and live capacity are checked again before your slot is reserved.</p>
        <button className="portal-button portal-button-dark" type="submit">Reserve this visit <ArrowRight size={15} /></button>
      </form> : <EmptyState icon={CalendarDays} title="No available visits yet." text="Available times appear here once you have an active plan and your community is verified." />}
    </section>
    <aside className="workspace-card workspace-aside"><CalendarDays size={22} /><p className="eyebrow eyebrow-muted">A CONFIRMED SERVICE</p><h3>Your place is really reserved.</h3><p>We only show services included in your current plan and open times in your verified community. A booking is confirmed when capacity has been reserved.</p></aside>
  </div>;
}

function MembershipView({ rows, plans, payments, onAction }: { rows: Row[]; plans: Row[]; payments: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const active = rows.find((row) => row.status === "ACTIVE");
  return <div className="membership-workspace">
    <section className="membership-summary workspace-card">
      <span className="membership-seal"><Sparkles size={23} /></span><div><p className="eyebrow eyebrow-muted">{active ? "YOUR ACTIVE PLAN" : "YOUR MEMBERSHIP"}</p>
        <h2>{active ? String(active.planName) : "A little care goes a long way."}</h2>
        <p>{active ? `Active · ${active.endsAt ? `Renews or ends ${formatDate(active.endsAt)}` : "No end date set"}` : "Choose a plan that fits your routine. Plans are only available after RIVORA confirms pricing for your area."}</p></div>
    </section>
    <div className="plan-portal-grid">{plans.map((plan) => <article className="portal-plan-card" key={String(plan.id)}>
      <p className="eyebrow eyebrow-muted">RIVORA MEMBERSHIP</p><h3>{String(plan.name)}</h3>
      <p>{String(plan.description || "Thoughtful car care, shaped around your drive.")}</p>
      <strong>{plan.priceMinor == null ? "Pricing to be confirmed" : formatMoney(plan.priceMinor, String(plan.currency))}<small>{plan.priceMinor == null ? "" : ` / ${plan.durationDays} days`}</small></strong>
      <span className={`status-pill ${plan.published ? "status-active" : "status-pending"}`}>{plan.published ? "Available" : "Not yet available"}</span>
      <ul>{(Array.isArray(plan.benefits) ? plan.benefits as Row[] : []).map((benefit) => <li key={String(benefit.title)}><Check size={14} />{String(benefit.title)}</li>)}</ul>
      <button className="portal-button portal-button-outline" disabled={!plan.published || plan.priceMinor == null || Boolean(active)}
        onClick={() => void onAction("membership.request", { planId: plan.id }, "Your request was recorded. Payment needs to be verified before membership begins.")}>
        {active ? "Current member" : plan.published && plan.priceMinor != null ? "Request membership" : "Coming soon"}
      </button>
    </article>)}</div>
    <p className="form-help"><ShieldCheck size={15} /> A payment record stays pending until an authorised team member verifies the payment and activates the plan.</p>
    {!!rows.length && <DataTable title="Your membership history" rows={rows} filtered={rows} />}
    {!!payments.length && <PaymentTable rows={payments} onAction={onAction} />}
  </div>;
}

function CustomerPayments({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><p className="eyebrow eyebrow-muted">YOUR PAYMENTS</p><h2>Receipts and payment updates.</h2>
    <PaymentTable rows={rows} onAction={onAction} />
  </div>;
}

function PaymentTable({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <DataTable title="Payment history" rows={rows} filtered={rows}
    columns={["planName","amountMinor","currency","status","providerReference","paidAt","createdAt"]}
    labels={{ amountMinor: "Amount", providerReference: "Payment reference" }}
    actions={(row) => row.status === "PENDING" ? <PaymentReferenceForm row={row} onAction={onAction} /> :
      row.status === "PAID" ? <Link className="text-action" href={`/portal/receipts/${String(row.id)}`}>Print receipt</Link> : <Status value={row.status} />} />;
}

function PaymentReferenceForm({ row, onAction }: { row: Row; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const [reference, setReference] = useState(String(row.providerReference ?? ""));
  const [open, setOpen] = useState(!row.providerReference);
  if (!open) return <button className="text-action" onClick={() => setOpen(true)}>Update reference</button>;
  return <form className="payment-reference-form" onSubmit={(event) => {
    event.preventDefault();
    void onAction("payment.submit-reference", { id: row.id, providerReference: reference },
      "Reference sent for reconciliation.");
    setOpen(false);
  }}><input value={reference} onChange={(event) => setReference(event.target.value)} required minLength={4} maxLength={160} placeholder="Provider payment reference" />
    <button type="submit">Send for review <ArrowRight size={13} /></button></form>;
}

function SupportView({ rows, onSubmit }: { rows: Row[]; onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void }) {
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary"><p className="eyebrow eyebrow-muted">WE&apos;RE HERE FOR YOU</p><h2>How can we help?</h2>
      <form className="portal-form" onSubmit={(event) => onSubmit(event, "support.create", "Your support request has been sent to our team.")}>
        <label>What do you need help with?<input name="subject" required minLength={3} maxLength={160} placeholder="A short summary" /></label>
        <label>Tell us a little more<textarea name="description" required minLength={5} maxLength={2000} rows={5} placeholder="Include the details that will help us support you" /></label>
        <button className="portal-button portal-button-dark" type="submit">Send to our care team <ArrowRight size={15} /></button>
      </form>
    </section>
    <section className="workspace-card"><div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">YOUR REQUESTS</p><h2>Follow the conversation</h2></div></div>
      {rows.length ? <div className="record-list">{rows.map((row) => <RecordCard key={String(row.id)} row={row} />)}</div> : <EmptyState icon={CircleHelp} title="No open requests." text="When you ask our team for help, you can follow its progress here." />}
    </section>
  </div>;
}

function AdminSupport({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <DataTable title="Customer support requests" rows={rows} filtered={rows} actions={(row) => <div className="row-actions">
    <button onClick={() => void onAction("ticket.update", { id: row.id, status: "IN_PROGRESS" }, "Ticket assigned for follow-up.")}>In progress</button>
    <button onClick={() => void onAction("ticket.update", { id: row.id, status: "RESOLVED", resolution: "Resolved by the RIVORA care team." }, "Ticket resolved.")}>Resolve</button>
  </div>} />;
}

function InquiriesView({ rows, onAction }: {
  rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  return <DataTable
    title="Public website enquiries"
    rows={rows}
    filtered={rows}
    columns={["name", "email", "city", "community", "message", "status", "createdAt"]}
    actions={(row) => <div className="row-actions">
      {row.status === "NEW" && <button onClick={() => void onAction("inquiry.update", { id: row.id, status: "CONTACTED" }, "Enquiry marked as contacted.")}>Mark contacted</button>}
      {row.status !== "CLOSED" && <button onClick={() => void onAction("inquiry.update", { id: row.id, status: "CLOSED" }, "Enquiry closed.")}>Close</button>}
      {row.status === "CLOSED" && <button onClick={() => void onAction("inquiry.update", { id: row.id, status: "NEW" }, "Enquiry reopened.")}>Reopen</button>}
    </div>}
  />;
}

function JobsView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="job-grid">{rows.length ? rows.map((row) => <article className="job-card" key={String(row.id)}>
    <div className="job-card-header"><span className="job-time"><Clock3 size={14} /> {formatDate(row.startsAt)}</span><Status value={row.status} /></div>
    <p className="eyebrow eyebrow-muted">{String(row.serviceName)}</p><h2>{String(row.make)} {String(row.model)}</h2>
    <p className="job-registration">{String(row.registration)}</p>
    <div className="job-details"><span><UsersRound size={14} /> {String(row.customerName)}</span><span><MapPin size={14} /> {String(row.communityName)}, {String(row.city)}</span>{Boolean(row.apartment) && <span>{String(row.apartment)}</span>}</div>
    {Boolean(row.customerNotes) && <p className="job-notes">Customer note: {String(row.customerNotes)}</p>}
    {Boolean(row.issue) && <p className="portal-alert portal-alert-error">{String(row.issue)}</p>}
    <div className="job-actions">
      {row.status === "ASSIGNED" && <button className="portal-button portal-button-outline" onClick={() => void onAction("job.status", { id: row.id, status: "ARRIVED" }, "Arrival recorded.")}>Mark arrived</button>}
      {row.status === "ARRIVED" && <button className="portal-button portal-button-outline" onClick={() => void onAction("job.status", { id: row.id, status: "STARTED" }, "Service started.")}>Start service</button>}
      {row.status === "ISSUE" && <button className="portal-button portal-button-outline" onClick={() => void onAction("job.status", { id: row.id, status: "STARTED" }, "Service resumed.")}>Resume service</button>}
      {row.status === "STARTED" && <CompletionForm id={String(row.id)} onAction={onAction} />}
      {["ASSIGNED", "ARRIVED", "STARTED"].includes(String(row.status)) && <IssueForm id={String(row.id)} onAction={onAction} />}
    </div>
  </article>) : <div className="workspace-card"><EmptyState icon={ListChecks} title="No assignments yet." text="New service assignments will appear here." /></div>}</div>;
}

function CompletionForm({ id, onAction }: { id: string; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  if (!open) return <button className="portal-button portal-button-dark" onClick={() => setOpen(true)}>Complete service <Check size={15} /></button>;
  return <form className="inline-job-form" onSubmit={async (event) => {
    event.preventDefault();
    if (!photo) {
     setError("Add a completion photo before closing this assignment.");
     return;
    }
    setUploading(true);
    setError("");
    try {
     const proofUrl = await uploadImage(photo, "proof");
     const done = await onAction("job.status", { id, status: "COMPLETED", completionNotes: notes, proofUrls: [proofUrl] }, "Completion recorded; customer service history updated.");
     if (done) setOpen(false);
    } catch (uploadError) {
     setError(uploadError instanceof Error ? uploadError.message : "The completion photo could not be uploaded.");
    } finally {
     setUploading(false);
    }
  }}>
    <label>Service notes<textarea required minLength={3} maxLength={1000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    <label>Completion photo<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
    {error && <p className="portal-alert portal-alert-error" role="alert">{error}</p>}
    <button className="portal-button portal-button-dark" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Save completion proof"} <Check size={15} /></button>
  </form>;
}

function IssueForm({ id, onAction }: { id: string; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  if (!open) return <button className="portal-button portal-button-light" onClick={() => setOpen(true)}>Report an issue</button>;
  return <form className="inline-job-form" onSubmit={async (event) => {
    event.preventDefault();
    const done = await onAction("job.status", { id, status: "ISSUE", issue }, "Issue reported to the operations team.");
    if (done) setOpen(false);
  }}>
    <label>What happened?<textarea required minLength={3} maxLength={1000} rows={2} value={issue} onChange={(event) => setIssue(event.target.value)} /></label>
    <button className="portal-button portal-button-light" type="submit">Send issue report</button>
  </form>;
}

function AttendanceView({ user, rows, onAction }: { user: SessionUser; rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const today = rows.find((row) => String(row.workDate).slice(0, 10) === new Date().toISOString().slice(0, 10) && !row.clockOutAt);
  return <div className="workspace-grid">
    <section className="workspace-card attendance-card"><span className="attendance-icon"><Clock3 size={24} /></span>
      <p className="eyebrow eyebrow-muted">{user.role === "ADMIN" ? "TEAM ATTENDANCE" : "TODAY'S ATTENDANCE"}</p>
      <h2>{user.role === "ADMIN" ? "Showing recent team records." : today ? "You're on the clock." : "Ready to start your workday?"}</h2>
      {user.role === "WORKER" && <button className="portal-button portal-button-dark" onClick={() => void onAction(today ? "attendance.clock-out" : "attendance.clock-in", {}, today ? "Your workday has been clocked out." : "You're clocked in for today.")}>
        {today ? "Clock out" : "Clock in"} <ArrowRight size={15} /></button>}
    </section>
    <section className="workspace-card"><p className="eyebrow eyebrow-muted">RECENT RECORDS</p><h2>Attendance history</h2><DataTable rows={rows} filtered={rows} compact /></section>
  </div>;
}

function OperationsView({ rows, services, communities, workers, onSubmit, onAction }: {
  rows: Row[]; services: Row[]; communities: Row[]; workers: Row[];
  onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  return <div className="operations-layout">
    <div className="operations-tools">
      <section className="workspace-card"><p className="eyebrow eyebrow-muted">PREPARE THE DAY</p><h2>Add a service window</h2>
        <form className="portal-form" onSubmit={(event) => onSubmit(event, "slot.create", "Service window added to the schedule.")}>
          <label>Community<select required name="communityId" defaultValue=""><option value="" disabled>Select a community</option>
            {communities.map((community) => <option key={String(community.id)} value={String(community.id)}>{String(community.name)}, {String(community.city)}</option>)}</select></label>
          <label>Service<select required name="serviceId" defaultValue=""><option value="" disabled>Select a service</option>
            {services.map((service) => <option key={String(service.id)} value={String(service.id)}>{String(service.name)}</option>)}</select></label>
          <div className="form-pair"><label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" required /></label></div>
          <label>Capacity<input name="capacity" type="number" min="1" max="50" defaultValue="1" required /></label>
          <button className="portal-button portal-button-dark" type="submit">Add to schedule <Plus size={15} /></button>
        </form>
      </section>
    </div>
    <section className="workspace-card operations-bookings"><div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">SERVICE DELIVERY</p><h2>Bookings to coordinate</h2></div><span className="data-count">{rows.length}</span></div>
      {rows.length ? <div className="operations-list">{rows.map((row) => <article className="operation-row" key={String(row.id)}>
        <div className="operation-date"><strong>{new Date(String(row.startsAt)).toLocaleDateString("en", { day: "2-digit" })}</strong><span>{new Date(String(row.startsAt)).toLocaleDateString("en", { month: "short" })}</span></div>
        <div className="operation-details"><strong>{String(row.serviceName)} · {String(row.make)} {String(row.model)}</strong><span>{String(row.customerName)} · {String(row.communityName)}, {String(row.city)} · {formatDate(row.startsAt)}</span></div>
        <Status value={row.status} />
        <div className="operation-assignment">
          {row.workerName ? <span><Check size={13} /> {String(row.workerName)}</span> : <select aria-label="Assign field professional" defaultValue="" onChange={(event) => event.target.value && void onAction("booking.assign", { bookingId: row.id, workerId: event.target.value }, "Service assigned.")}>
            <option value="" disabled>Assign team member</option>{workers.filter((worker) => worker.status === "ACTIVE").map((worker) => <option key={String(worker.id)} value={String(worker.id)}>{String(worker.name)}</option>)}</select>}
          {row.status === "CONFIRMED" && <button className="text-action" onClick={() => void onAction("booking.update", { id: row.id, status: "CANCELLED" }, "Booking cancelled.")}>Cancel booking</button>}
        </div>
      </article>)}</div> : <EmptyState icon={CalendarDays} title="The schedule is clear." text="Confirmed customer visits will appear here." />}
    </section>
  </div>;
}

function PlansView({ rows, services, onSubmit, onAction }: {
  rows: Row[]; services: Row[];
  onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string, extra?: Row) => void;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const [planId, setPlanId] = useState("");
  const [benefits, setBenefits] = useState("Recurring care\nService history");
  const selected = rows.find((row) => row.id === planId);
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary"><p className="eyebrow eyebrow-muted">PLAN CONFIGURATION</p><h2>Shape a membership</h2>
      <label className="portal-label">Choose a plan<select value={planId} onChange={(event) => {
        const choice = rows.find((row) => row.id === event.target.value);
        setPlanId(event.target.value);
        setBenefits(Array.isArray(choice?.benefits) ? (choice.benefits as Row[]).map((benefit) => String(benefit.title)).join("\n") : "");
      }}><option value="">Select a plan to edit</option>{rows.map((plan) => <option key={String(plan.id)} value={String(plan.id)}>{String(plan.name)}</option>)}</select></label>
      <form key={planId} className="portal-form" onSubmit={(event) => {
        const form = event.currentTarget;
        const extra = {
          id: planId || undefined,
          benefits: benefits.split("\n").map((title) => title.trim()).filter(Boolean).map((title) => ({ title, description: "" })),
          serviceIds: Array.from(form.querySelectorAll<HTMLInputElement>('input[name="serviceIds"]:checked')).map((input) => input.value),
        };
        onSubmit(event, "plan.save", "Plan saved. Published pricing should be confirmed before taking payment.", extra);
      }}>
        <label>Plan<select name="name" defaultValue={String(selected?.name ?? "Discovery")}>
          {["Discovery", "Signature", "Privilege"].map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Description<textarea name="description" maxLength={500} rows={3} defaultValue={String(selected?.description ?? "")} /></label>
        <div className="form-pair"><label>Price (minor currency units)<input name="priceMinor" type="number" min="0" defaultValue={selected?.priceMinor == null ? "" : String(selected.priceMinor)} placeholder="Not set" /></label>
          <label>Currency<input name="currency" required minLength={3} maxLength={3} defaultValue={String(selected?.currency ?? "INR")} /></label></div>
        <label>Duration in days<input name="durationDays" type="number" min="1" max="3650" required defaultValue={String(selected?.durationDays ?? 30)} /></label>
        <label>Benefits <small>One benefit per line</small><textarea rows={4} value={benefits} onChange={(event) => setBenefits(event.target.value)} /></label>
        <div className="portal-check-grid"><span className="portal-label">Eligible services</span>{services.map((service) => <label key={String(service.id)}><input type="checkbox" name="serviceIds" value={String(service.id)} defaultChecked={(selected?.serviceIds as string[] | undefined)?.includes(String(service.id))} />{String(service.name)}</label>)}</div>
        <div className="form-pair portal-check-row"><label><input type="checkbox" name="clubAccess" defaultChecked={Boolean(selected?.clubAccess)} /> RIVORA Club access</label><label><input type="checkbox" name="published" defaultChecked={Boolean(selected?.published)} /> Publish</label></div>
        <p className="form-help"><ShieldCheck size={15} /> Publishing requires a confirmed, non-zero price. Membership access only starts after reconciled payment.</p>
        <button className="portal-button portal-button-dark" type="submit" disabled={!selected}>Save membership <Check size={15} /></button>
      </form>
    </section>
    <aside className="workspace-card workspace-aside"><p className="eyebrow eyebrow-muted">AVAILABLE SERVICES</p><h3>Keep the service list current.</h3>
      {services.map((service) => <div className="service-admin-row" key={String(service.id)}><span>{String(service.name)}</span><Status value={service.active ? "ACTIVE" : "PAUSED"} /></div>)}
      <form className="portal-form top-divider" onSubmit={(event) => onSubmit(event, "service.save", "Service added to the catalogue.")}>
        <label>New service<input name="name" required maxLength={100} placeholder="Service name" /></label>
        <label>Description<input name="description" maxLength={500} placeholder="Short description" /></label>
        <button className="portal-button portal-button-outline" type="submit"><Plus size={14} /> Add service</button>
      </form>
      {selected && <button className="text-action" onClick={() => void onAction("plan.save", { ...selected, id: selected.id, benefits: selected.benefits ?? [], serviceIds: selected.serviceIds ?? [] }, "Plan settings left unchanged.")}>Review selected plan</button>}
    </aside>
  </div>;
}

function CommunitiesView({ rows, onSubmit, onReload }: {
  rows: Row[];
  onSubmit: (event: FormEvent<HTMLFormElement>, action: string, success: string) => void;
  onReload: () => void;
}) {
  return <div className="workspace-grid">
    <section className="workspace-card workspace-primary">
      <p className="eyebrow eyebrow-muted">SERVICE AREAS</p><h2>Communities we care for.</h2>
      {rows.length ? <div className="community-grid">{rows.map((row) => <article className="community-card" key={String(row.id)}>
        <span className="community-marker"><MapPin size={18} /></span><Status value={row.active ? "ACTIVE" : "PAUSED"} />
        <h3>{String(row.name)}</h3><p>{String(row.city)}</p><div><span>{String(row.customers)} customers</span><span>{String(row.upcomingSlots)} upcoming times</span></div>
      </article>)}</div> : <EmptyState icon={MapPin} title="Start with a community." text="Add a service area before scheduling visits." />}
    </section>
    <section className="workspace-card workspace-aside"><p className="eyebrow eyebrow-muted">ADD A SERVICE AREA</p><h3>Bring thoughtful care closer to home.</h3>
      <form className="portal-form" onSubmit={(event) => { onSubmit(event, "community.save", "Community saved."); setTimeout(onReload, 250); }}>
        <label>Community name<input name="name" required maxLength={120} /></label>
        <label>City<input name="city" required maxLength={80} /></label>
        <label>Service address<input name="address" maxLength={300} placeholder="Optional operational address" /></label>
        <label>Service capacity<input name="capacity" type="number" min="0" max="10000" defaultValue="0" /></label>
        <button className="portal-button portal-button-dark" type="submit"><Plus size={15} /> Add community</button>
      </form>
    </section>
  </div>;
}

function CustomersView({ rows, communities, onAction }: {
  rows: Row[]; communities: Row[];
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  return <div className="workspace-card">
    <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">CUSTOMER ACCOUNTS</p><h2>Members and verified communities</h2></div><span className="data-count">{rows.length}</span></div>
    <DataTable rows={rows} filtered={rows} columns={["name","memberId","email","communityRequest","city","communityName","vehicleCount","activeSubscriptions","status","createdAt"]}
      labels={{ communityRequest: "Community requested", communityName: "Verified community", vehicleCount: "Vehicles", activeSubscriptions: "Active plans" }}
      actions={(row) => <div className="customer-row-actions">
        <select aria-label={`Verify community for ${String(row.name)}`} defaultValue={String(row.communityId ?? "")}
          onChange={(event) => void onAction("customer.community", { userId: row.id, communityId: event.target.value }, "Community verification updated.")}>
          <option value="">Not verified</option>{communities.filter((item) => item.active).map((community) => <option key={String(community.id)} value={String(community.id)}>{String(community.name)}, {String(community.city)}</option>)}
        </select>
        <button className="text-action" onClick={() => void onAction("customer.status", { userId: row.id, status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }, `Account ${row.status === "ACTIVE" ? "suspended" : "restored"}.`)}>
          {row.status === "ACTIVE" ? "Suspend" : "Restore"}
        </button>
      </div>} />
  </div>;
}

function SubscriptionView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card">
    <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">SUBSCRIPTION LIFECYCLE</p><h2>Memberships and renewals</h2></div><span className="data-count">{rows.length}</span></div>
    <DataTable rows={rows} filtered={rows} columns={["customerName","customerEmail","planName","status","priceMinor","currency","startsAt","endsAt","autoRenew","clubAccess","createdAt"]}
      labels={{ priceMinor: "Plan price", customerName: "Customer", customerEmail: "Email", planName: "Membership", clubAccess: "Club access" }}
      actions={(row) => row.status === "ACTIVE" || row.status === "PAUSED" ? <button className="text-action" onClick={() => void onAction("subscription.update", { id: row.id, status: row.status === "ACTIVE" ? "PAUSED" : "CANCELLED" }, `Membership ${row.status === "ACTIVE" ? "paused" : "cancelled"}.`)}>
        {row.status === "ACTIVE" ? "Pause access" : "Cancel"}
      </button> : <span className="muted-caption">Activation requires reconciled payment</span>} />
    <p className="form-help"><ShieldCheck size={15} /> Memberships cannot be activated from this screen without a reconciled payment record.</p>
  </div>;
}

function TeamsView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="teams-layout">
    <div className="workspace-card"><div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">FIELD TEAM</p><h2>People who make it happen.</h2></div></div>
      <DataTable rows={rows} filtered={rows} columns={["name","memberId","email","phone","activeJobs","attendanceToday","status"]}
        actions={(row) => <div className="team-row-actions">
          <button className="text-action" onClick={() => void onAction("worker.status", { userId: row.id, status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }, `Field account ${row.status === "ACTIVE" ? "suspended" : "restored"}.`)}>
            {row.status === "ACTIVE" ? "Suspend access" : "Restore access"}
          </button>
          <StaffAccessManager row={row} onAction={onAction} />
        </div>} />
    </div>
    <section className="workspace-card"><p className="eyebrow eyebrow-muted">ONBOARD A PROFESSIONAL</p><h3>Invite a worker account</h3>
      <form className="portal-form" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries()) as Row;
        void onAction("worker.create", values, "Worker account created. Share the initial password securely.");
        form.reset();
      }}>
        <label>Full name<input name="name" required minLength={2} maxLength={80} /></label>
        <label>Work email<input name="email" type="email" required maxLength={254} /></label>
        <label>Phone number<input name="phone" maxLength={30} /></label>
        <label>Temporary password<input name="password" type="password" required minLength={12} maxLength={72} /></label>
        <button className="portal-button portal-button-dark" type="submit"><Plus size={15} /> Create worker</button>
      </form>
    </section>
  </div>;
}

function StaffAccessManager({ row, onAction }: {
  row: Row;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const permissions = Array.isArray(row.permissions) ? row.permissions.map(String) : [];
  return <details className="staff-access-manager">
    <summary>Manage permissions</summary>
    <div>{staffScopes.map(([scope, label]) => <label key={scope}>
      <input type="checkbox" checked={permissions.includes(scope)} onChange={(event) => {
        void onAction("staff.permission", {
          userId: row.id, scope, granted: event.target.checked,
        }, `Staff access updated for ${label.toLowerCase()}.`);
      }} />
      <span>{label}</span>
    </label>)}</div>
  </details>;
}

function SettingsView({ data, onAction }: {
  data: Row;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const [settings, setSettings] = useState({
    registrationEnabled: data.registrationEnabled !== false,
    clubEnabled: data.clubEnabled !== false,
    parkingEnabled: data.parkingEnabled !== false,
    carMarketplaceEnabled: data.carMarketplaceEnabled !== false,
    supportEmail: String(data.supportEmail ?? ""),
  });
  return <div className="settings-layout">
    <section className="workspace-card"><p className="eyebrow eyebrow-muted">PLATFORM AVAILABILITY</p><h2>Control customer-facing modules.</h2>
      <form className="portal-form" onSubmit={(event) => {
        event.preventDefault();
        void onAction("settings.save", settings, "Platform settings saved.");
      }}>
        {([
          ["registrationEnabled", "New customer registration"],
          ["clubEnabled", "RIVORA Club"],
          ["parkingEnabled", "Parking marketplace"],
          ["carMarketplaceEnabled", "Car marketplace"],
        ] as const).map(([key, label]) => <label className="portal-checkbox settings-toggle" key={key}>
          <input type="checkbox" checked={settings[key]} onChange={(event) =>
            setSettings((current) => ({ ...current, [key]: event.target.checked }))} />
          <span>{label}</span>
        </label>)}
        <label>Customer support email<input type="email" maxLength={254} value={settings.supportEmail}
          onChange={(event) => setSettings((current) => ({ ...current, supportEmail: event.target.value }))} placeholder="Add an approved support address" /></label>
        <button className="portal-button portal-button-dark" type="submit">Save platform settings <Check size={15} /></button>
      </form>
      <p className="form-help">Turning a module off blocks its API workflows immediately. Payment, email, legal, and tax settings still require approved external-provider details.</p>
    </section>
    <section className="workspace-card"><p className="eyebrow eyebrow-muted">STAFF ACCESS</p><h2>Permissions are granted per field account.</h2>
      <p>Use Employees &amp; teams to grant the least access needed for each worker. Changes are recorded in the audit history and apply to the next request.</p>
      <Link className="portal-button portal-button-outline" href="/portal">Return to portal</Link>
    </section>
  </div>;
}

function ModerationView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">MEMBER SAFETY</p><h2>Reports, reviewed with care.</h2></div><span className="data-count">{rows.filter((row) => ["OPEN", "REVIEWING"].includes(String(row.status))).length} open</span></div>
    <DataTable rows={rows} filtered={rows} columns={["targetType","reason","reporterName","status","createdAt"]}
      labels={{ targetType: "Reported content", reporterName: "Reported by" }}
      actions={(row) => <div className="row-actions">
        <button onClick={() => void onAction("report.review", { id: row.id, status: "REVIEWING", action: "NONE" }, "Report marked for review.")}>Review</button>
        {["POST","MESSAGE","LISTING"].includes(String(row.targetType)) &&
          <button className="danger-action" onClick={() => void onAction("report.review", { id: row.id, status: "ACTIONED", moderationAction: "HIDE_CONTENT" }, "Reported content removed from the marketplace.")}>Remove content</button>}
        {row.targetType === "PROFILE" &&
          <button className="danger-action" onClick={() => void onAction("report.review", { id: row.id, status: "ACTIONED", action: "SUSPEND_CUSTOMER" }, "Customer account suspended for review.")}>Suspend profile</button>}
        <button onClick={() => void onAction("report.review", { id: row.id, status: "DISMISSED", action: "NONE" }, "Report dismissed.")}>Dismiss</button>
      </div>} />
  </div>;
}

function ClubView({ data, user, onAction }: {
  data: Row; user: SessionUser;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const posts = Array.isArray(data.posts) ? data.posts as Row[] : [];
  const conversations = Array.isArray(data.conversations) ? data.conversations as Row[] : [];
  const profile = data.profile && typeof data.profile === "object" ? data.profile as Row : {};
  const [openMessages, setOpenMessages] = useState(true);
  return <div className="club-workspace">
    <div className="club-main-column">
      <section className="club-compose workspace-card"><p className="eyebrow eyebrow-muted">A NOTE FROM YOU</p><h2>What&apos;s on your mind?</h2>
        <form className="portal-form" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = new FormData(form).get("body");
          const audience = new FormData(form).get("audience");
          void onAction("club.post", { body, audience }, "Your post is shared with its selected audience.");
          form.reset();
        }}>
          <textarea name="body" rows={3} required maxLength={2000} placeholder="Share a thought, a tip, or a little joy from the road…" />
          <div className="club-compose-bottom"><label>Who can see this?<select name="audience" defaultValue="PRIVATE">
            <option value="PRIVATE">Only me</option><option value="CLUB">RIVORA Club members</option>
            {user.communityId && <option value="COMMUNITY">My verified community</option>}
          </select></label><button className="portal-button portal-button-dark" type="submit">Share a post <ArrowRight size={15} /></button></div>
        </form>
      </section>
      {posts.length ? posts.map((post) => <article className="club-post workspace-card" key={String(post.id)}>
        <div className="club-post-head"><span className="club-avatar">{initials(String(post.authorName))}</span><div><strong>{String(post.authorName)}</strong><small>{String(post.memberId)} · {String(post.communityName ?? "RIVORA Club")} · {formatDate(post.createdAt)}</small></div>
          {post.authorId !== user.id && <button className="icon-action" aria-label="Report member" onClick={() => void onAction("club.report", { targetType: "POST", targetId: post.id, reason: "Content appears inappropriate." }, "Report sent to RIVORA moderation.")}><ShieldQuestion size={16} /></button>}</div>
        <p className="club-post-body">{String(post.body)}</p>
        <div className="club-reactions">
          <button className={post.myReaction === "LIKE" ? "reaction-active" : ""} onClick={() => void onAction("club.react", { postId: post.id, reaction: post.myReaction === "LIKE" ? null : "LIKE" }, "Reaction updated.")}>♡ <span>{String(post.likes ?? 0)}</span> Like</button>
          <button className={post.myReaction === "LOVE" ? "reaction-active" : ""} onClick={() => void onAction("club.react", { postId: post.id, reaction: post.myReaction === "LOVE" ? null : "LOVE" }, "Reaction updated.")}><Heart size={14} /> <span>{String(post.loves ?? 0)}</span> Love</button>
          {post.authorId !== user.id && <button className="text-action" onClick={() => {
            const body = window.prompt("Write the first message request. Reading is private; only a reply opens the chat.");
            if (body) void onAction("club.request", { recipientId: post.authorId, body }, "Message request sent.");
          }}>Message request <ArrowUpRight size={13} /></button>}
        </div>
      </article>) : <section className="workspace-card"><EmptyState icon={Heart} title="Your Club starts here." text="Create a post for yourself or share it with members. An active Signature or Privilege membership is required." /></section>}
      <section className="workspace-card club-conversations"><button className="conversation-toggle" onClick={() => setOpenMessages(!openMessages)}><span><MessageCircle size={17} /> Messages & requests</span><ChevronDown className={openMessages ? "rotate-chevron" : ""} size={16} /></button>
        {openMessages && (conversations.length ? conversations.map((conversation) => <ConversationCard key={String(conversation.id)} conversation={conversation} user={user} onAction={onAction} />) :
          <p className="empty-inline">Member-to-member messaging stays closed until a recipient replies to a request.</p>)}
      </section>
    </div>
    <aside className="club-side-column">
      <section className="workspace-card club-profile-card"><span className="club-avatar club-avatar-large">{initials(user.name)}</span><p className="eyebrow eyebrow-muted">YOUR MEMBER PROFILE</p><h3>{String(profile.displayName || user.name)}</h3><span className="club-member-id">{user.memberId}</span>
        <form className="portal-form" onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget).entries());
          void onAction("club.privacy", { ...values, pauseMessaging: values.pauseMessaging === "on" }, "Club profile and privacy saved.");
        }}>
          <label>Display name<input name="displayName" maxLength={60} defaultValue={String(profile.displayName ?? "")} placeholder={user.name} /></label>
          <label>Short bio<textarea name="bio" maxLength={300} rows={2} defaultValue={String(profile.bio ?? "")} /></label>
          <label>Profile audience<select name="audience" defaultValue={String(profile.audience ?? "PRIVATE")}>
            <option value="PRIVATE">Only me</option><option value="CLUB">Club members</option>{user.communityId && <option value="COMMUNITY">My verified community</option>}
          </select></label>
          <label>Message requests<select name="acceptRequests" defaultValue={String(profile.acceptRequests ?? "ALL")}><option value="ALL">All active Club members</option><option value="COMMUNITY">My verified community</option><option value="NONE">Nobody</option></select></label>
          <label className="portal-checkbox"><input type="checkbox" name="pauseMessaging" defaultChecked={Boolean(profile.pauseMessaging)} /> Pause all messaging</label>
          <button className="portal-button portal-button-outline" type="submit">Save privacy settings</button>
        </form>
      </section>
      <section className="workspace-card club-safety-note"><ShieldCheck size={19} /><h3>Your space, your boundaries.</h3><p>A request is only a first note. Reading never opens chat. You can decline, block or independently lock a conversation at any time.</p></section>
    </aside>
  </div>;
}

function ConversationCard({ conversation, user, onAction }: {
  conversation: Row; user: SessionUser; onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages as Row[] : [];
  const requester = conversation.requesterId === user.id;
  const locked = requester ? Boolean(conversation.lockedByRequester) : Boolean(conversation.lockedByRecipient);
  return <article className="conversation-card">
    <div className="conversation-card-head"><div><strong>{String(conversation.otherName)}</strong><small>{String(conversation.otherMemberId)}</small></div><Status value={conversation.status} /></div>
    {messages.map((message) => <p className={`conversation-message ${message.senderId === user.id ? "conversation-own-message" : ""}`} key={String(message.id)}>{String(message.body)}</p>)}
    <div className="conversation-actions">
      {conversation.status === "PENDING" && !requester && <ReplyForm id={String(conversation.id)} action="club.reply" onAction={onAction} />}
      {conversation.status === "PENDING" && !requester && <button className="text-action" onClick={() => void onAction("club.decline", { conversationId: conversation.id }, "Message request declined.")}>Decline</button>}
      {conversation.status === "PENDING" && requester && <span className="muted-caption">Waiting for a reply · this is your only initial request.</span>}
      {conversation.status === "ACCEPTED" && !locked && <ReplyForm id={String(conversation.id)} action="club.message" onAction={onAction} />}
      {conversation.status === "ACCEPTED" && <button className="text-action" onClick={() => void onAction("club.lock", { conversationId: conversation.id, locked: !locked }, locked ? "Your lock was removed." : "You locked your side of this conversation.")}>{locked ? "Unlock my side" : "Lock my side"}</button>}
      {conversation.status !== "DECLINED" && <button className="text-action danger-action" onClick={() => void onAction("club.block", { memberId: requester ? conversation.recipientId : conversation.requesterId, blocked: true }, "Member blocked.")}>Block</button>}
    </div>
  </article>;
}

function ReplyForm({ id, action, onAction }: { id: string; action: "club.reply" | "club.message"; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <form className="conversation-reply" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    void onAction(action, { conversationId: id, body }, action === "club.reply" ? "Your reply opened this conversation." : "Message sent.");
    form.reset();
  }}><input name="body" required maxLength={2000} placeholder="Write your reply…" /><button type="submit" aria-label="Send reply"><ArrowRight size={15} /></button></form>;
}

function ParkingView({ active, rows, user, onAction }: {
  active: string; rows: Row[]; user: SessionUser;
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const marketRows = rows.filter((row) =>
    [row.title, row.description, row.communityName, row.city].some((value) =>
      String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())));
  async function submitParkingListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setUploadError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const mediaUrls = await uploadImages(files, "listing");
      const values = Object.fromEntries([...formData.entries()].filter(([key]) => key !== "photos"));
      const done = await onAction("parking.create", { ...values, mediaUrls }, "Listing sent for operations review.");
      if (done) form.reset();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The listing photos could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }
  if (active === "myParking" || active === "rentalRequests" || active === "myBids" || active === "parkingIncomingBids") {
    return     <div className="workspace-card"><p className="eyebrow eyebrow-muted">{active === "myParking" ? "YOUR PARKING LISTINGS" : active === "myBids" ? "YOUR PARKING BIDS" : active === "parkingIncomingBids" ? "OFFERS ON YOUR LISTINGS" : "YOUR PARKING RENTALS"}</p>
      <h2>{active === "myParking" ? "Shared with your community." : active === "myBids" ? "Your community space bids." : active === "parkingIncomingBids" ? "Review offers for your space." : "A place to park, in good order."}</h2>
      {active === "rentalRequests" ? <DataTable rows={rows} filtered={rows} columns={["title","ownerName","renterName","startsOn","endsOn","status","createdAt"]}
        actions={(row) => <RentalActions row={row} user={user} onAction={onAction} />} /> :
        active === "myBids" ? <DataTable rows={rows} filtered={rows} columns={["title","communityName","amountMinor","bidStatus","listingStatus","createdAt"]} /> :
        active === "parkingIncomingBids" ? <DataTable rows={rows} filtered={rows}
          columns={["title","communityName","bidderName","bidderMemberId","amountMinor","status","createdAt"]}
          actions={(row) => row.status === "PENDING" ? <div className="row-actions">
            <button onClick={() => void onAction("parking.bid.review", { id: row.id, status: "ACCEPTED" }, "Bid accepted and listing awarded.")}>Accept bid</button>
            <button className="danger-action" onClick={() => void onAction("parking.bid.review", { id: row.id, status: "DECLINED" }, "Bid declined.")}>Decline</button>
          </div> : <Status value={row.status} />} /> :
        <DataTable rows={rows} filtered={rows} columns={["title","communityName","priceMinor","availableFrom","availableTo","status","bidCount"]}
          actions={(row) => row.status === "DRAFT" ? <div className="row-actions"><span className="muted-caption">Awaiting review</span>
            <button className="text-action" onClick={() => void onAction("parking.status", { id: row.id, status: "WITHDRAWN" }, "Your listing was withdrawn.")}>Withdraw</button></div> :
            row.status === "ACTIVE" ?
              <button className="text-action" onClick={() => void onAction("parking.status", { id: row.id, status: "WITHDRAWN" }, "Your listing was withdrawn.")}>Withdraw</button> :
              <Status value={row.status} />} />}
    </div>;
  }
  return <div className="marketplace-layout">
    <section className="workspace-card marketplace-listings">
      <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">PARKING IN YOUR COMMUNITY</p><h2>Find a space that fits.</h2></div><span className="data-count">{marketRows.length} spaces</span></div>
      <label className="market-search"><span className="sr-only">Search parking listings</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search spaces, details, or community" /></label>
      {marketRows.length ? <div className="marketplace-grid">{marketRows.map((row) => <article className="marketplace-card" key={String(row.id)}>
        {Array.isArray(row.mediaUrls) && row.mediaUrls[0] && <Image className="marketplace-card-image" src={String(row.mediaUrls[0])} alt={String(row.title)} width={600} height={360} unoptimized />}
        <span className="marketplace-icon"><MapPin size={19} /></span><p className="eyebrow eyebrow-muted">{String(row.communityName)}, {String(row.city)}</p>
        <h3>{String(row.title)}</h3><p>{String(row.description || "A parking space, shared by a member in your community.")}</p>
        <strong>{formatMoney(row.priceMinor, "INR")}<small> / month</small></strong>
        <span className="marketplace-date">Available from {formatDate(row.availableFrom)}{row.availableTo ? ` to ${formatDate(row.availableTo)}` : ""}</span>
        <details className="marketplace-details"><summary>View listing details</summary><p>{String(row.description || "No additional details supplied.")}</p><span>Listed by {String(row.ownerName)} · {String(row.bidCount)} member bids</span></details>
        <ParkingRequestActions listing={row} onAction={onAction} />
      </article>)}</div> : <EmptyState icon={MapPin} title={rows.length ? "No matching spaces." : "No spaces are listed yet."} text={rows.length ? "Try a different search." : "Approved parking spaces in your community will appear here."} />}
    </section>
    <section className="workspace-card marketplace-create">
      <p className="eyebrow eyebrow-muted">SHARE A SPACE</p><h2>List your parking.</h2>
      {user.communityId ? <form className="portal-form" onSubmit={submitParkingListing}>
        <input type="hidden" name="communityId" value={user.communityId} />
        <label>Listing title<input name="title" required minLength={3} maxLength={120} placeholder="e.g. Covered resident parking" /></label>
        <label>Details<textarea name="description" maxLength={1000} rows={3} /></label>
        <label>Monthly price (minor currency units)<input name="priceMinor" required type="number" min="0" /></label>
        <div className="form-pair"><label>Available from<input name="availableFrom" type="date" required /></label><label>Available until<input name="availableTo" type="date" /></label></div>
        <label>Listing photos<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
        {uploadError && <p className="portal-alert portal-alert-error" role="alert">{uploadError}</p>}
        <button className="portal-button portal-button-dark" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Submit for review"} <ArrowRight size={15} /></button>
      </form> : <EmptyState icon={ShieldCheck} title="Verify your community first." text="The marketplace only connects members in the same verified residential community." />}
    </section>
  </div>;
}

function ParkingRequestActions({ listing, onAction }: { listing: Row; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"none" | "bid" | "rent">("none");
  return <div className="marketplace-card-actions">
    {mode === "none" ? <>
      <button className="portal-button portal-button-outline" onClick={() => setMode("rent")}>Request rental <ArrowRight size={14} /></button>
      <button className="text-action" onClick={() => setMode("bid")}>Place a bid <ArrowUpRight size={13} /></button>
    </> : mode === "bid" ? <form className="mini-market-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const amountMinor = new FormData(form).get("amountMinor");
      if (await onAction("parking.bid", { listingId: listing.id, amountMinor }, "Your bid was sent.")) setMode("none");
    }}><label>Your bid (minor units)<input type="number" name="amountMinor" min="1" required /></label><button className="portal-button portal-button-dark" type="submit">Send bid</button></form> :
      <form className="mini-market-form" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries());
        if (await onAction("parking.rent", { listingId: listing.id, ...values }, "Rental request sent to the owner.")) setMode("none");
      }}><label>From<input type="date" name="startsOn" required /></label><label>Until<input type="date" name="endsOn" required /></label><button className="portal-button portal-button-dark" type="submit">Send request</button></form>}
    {Number(listing.bidCount) > 0 && <span className="muted-caption">{String(listing.bidCount)} bids received</span>}
  </div>;
}

function RentalActions({ row, user, onAction }: { row: Row; user: SessionUser; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const isOwner = row.ownerId === user.id;
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const rentalEnded = String(row.endsOn).slice(0, 10) < todayText;
  return <div className="row-actions">
    {row.status === "REQUESTED" && (user.role === "ADMIN" || isOwner) && <>
      <button onClick={() => void onAction("rental.update", { id: row.id, status: "APPROVED" }, "Rental dates approved.")}>Approve</button>
      <button className="danger-action" onClick={() => void onAction("rental.update", { id: row.id, status: "DECLINED" }, "Rental request declined.")}>Decline</button>
    </>}
    {row.status === "REQUESTED" && !isOwner && user.role !== "ADMIN" && <button onClick={() => void onAction("rental.update", { id: row.id, status: "CANCELLED" }, "Rental request cancelled.")}>Cancel request</button>}
    {row.status === "APPROVED" && (user.role === "ADMIN" || !isOwner) && <button className="danger-action" onClick={() => void onAction("rental.update", { id: row.id, status: "CANCELLED" }, "Rental cancelled.")}>Cancel rental</button>}
    {row.status === "APPROVED" && rentalEnded && <button onClick={() => void onAction("rental.update", { id: row.id, status: "COMPLETED" }, "Rental marked complete.")}>Mark complete</button>}
    {row.status === "APPROVED" && !rentalEnded && <Status value={row.status} />}
    {!["REQUESTED", "APPROVED"].includes(String(row.status)) && <Status value={row.status} />}
  </div>;
}

function CarsView({ active, rows, onAction }: {
  active: string; rows: Row[];
  onAction: (action: string, values: Row, success: string) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const marketRows = rows.filter((row) =>
    [row.make, row.model, row.year, row.description, row.sellerName].some((value) =>
      String(value ?? "").toLowerCase().includes(search.trim().toLowerCase())));
  async function submitCarListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setUploadError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const mediaUrls = await uploadImages(files, "listing");
      const values = Object.fromEntries([...formData.entries()].filter(([key]) => key !== "photos"));
      const done = await onAction("car.create", { ...values, mediaUrls }, "Car listing sent for operations review.");
      if (done) form.reset();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The listing photos could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }
  if (active === "myCars") return <div className="workspace-card"><p className="eyebrow eyebrow-muted">YOUR LISTINGS</p><h2>Every listing, in good order.</h2>
    <DataTable rows={rows} filtered={rows} columns={["make","model","year","priceMinor","status","enquiryCount","createdAt"]}
      actions={(row) => row.status === "ACTIVE" && <button className="text-action" onClick={() => void onAction("car.status", { id: row.id, status: "SOLD" }, "Listing marked sold.")}>Mark sold</button>} />
  </div>;
  if (active === "carEnquiries") return <div className="workspace-card"><p className="eyebrow eyebrow-muted">MARKETPLACE CONVERSATIONS</p><h2>Interested members, in one place.</h2>
    <DataTable rows={rows} filtered={rows} columns={["make","model","sellerName","buyerName","message","createdAt"]} />
  </div>;
  if (active === "savedCars") return <div className="workspace-card"><p className="eyebrow eyebrow-muted">SAVED FOR LATER</p><h2>Good drives to come back to.</h2>
    <DataTable rows={rows} filtered={rows} columns={["make","model","year","description","priceMinor","sellerName"]}
      actions={(row) => <button className="text-action" onClick={() => void onAction("car.save", { listingId: row.id, saved: false }, "Removed from saved cars.")}>Remove</button>} />
  </div>;
  return <div className="marketplace-layout">
    <section className="workspace-card marketplace-listings">
      <div className="workspace-card-heading"><div><p className="eyebrow eyebrow-muted">RIVORA MEMBER MARKETPLACE</p><h2>A good drive finds a new home.</h2></div><span className="data-count">{rows.length} cars</span></div>
      <label className="market-search"><span className="sr-only">Search car listings</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search make, model, seller, or details" /></label>
      {marketRows.length ? <div className="marketplace-grid">{marketRows.map((row) => <article className="marketplace-card car-market-card" key={String(row.id)}>
        {Array.isArray(row.mediaUrls) && row.mediaUrls[0] && <Image className="marketplace-card-image" src={String(row.mediaUrls[0])} alt={`${String(row.make)} ${String(row.model)}`} width={600} height={360} unoptimized />}
        <span className="marketplace-icon"><CarFront size={19} /></span><p className="eyebrow eyebrow-muted">LISTED BY {String(row.sellerName).toUpperCase()}</p>
        <h3>{String(row.make)} {String(row.model)}</h3><p>{[row.year, row.description].filter(Boolean).map(String).join(" · ")}</p>
        <details className="marketplace-details"><summary>View vehicle details</summary><p>{String(row.description)}</p><span>{row.year ? `Model year ${String(row.year)} · ` : ""}Seller: {String(row.sellerName)}</span></details>
        <strong>{formatMoney(row.priceMinor, "INR")}</strong>
        <div className="marketplace-card-actions">
          <button className="portal-button portal-button-outline" onClick={() => {
            const message = window.prompt("Write a short enquiry to the seller.");
            if (message) void onAction("car.enquire", { listingId: row.id, message }, "Your enquiry was sent to the seller.");
          }}>Ask the seller <ArrowRight size={14} /></button>
          <button className={`text-action ${row.saved ? "reaction-active" : ""}`} onClick={() => void onAction("car.save", { listingId: row.id, saved: !row.saved }, row.saved ? "Removed from saved cars." : "Car saved for later.")}>
            <Heart size={14} /> {row.saved ? "Saved" : "Save car"}
          </button>
          <button className="text-action" onClick={() => void onAction("club.report", { targetType: "LISTING", targetId: row.id, reason: "Marketplace listing needs review." }, "Listing reported to RIVORA moderation.")}>Report listing</button>
        </div>
      </article>)}</div> : <EmptyState icon={CarFront} title={rows.length ? "No matching cars." : "No cars are listed yet."} text={rows.length ? "Try a different search." : "Cars reviewed by RIVORA operations will appear here."} />}
    </section>
    <section className="workspace-card marketplace-create"><p className="eyebrow eyebrow-muted">SELL YOUR CAR</p><h2>List a car for members.</h2>
      <form className="portal-form" onSubmit={submitCarListing}>
        <label>Make<input name="make" required maxLength={60} /></label><label>Model<input name="model" required maxLength={80} /></label>
        <label>Year<input name="year" type="number" min="1950" max="2100" /></label>
        <label>Asking price (minor currency units)<input name="priceMinor" type="number" min="0" required /></label>
        <label>Details<textarea name="description" rows={4} minLength={10} maxLength={2000} required placeholder="Vehicle details, condition, and anything a fellow member should know." /></label>
        <label>Vehicle photos<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
        {uploadError && <p className="portal-alert portal-alert-error" role="alert">{uploadError}</p>}
        <button className="portal-button portal-button-dark" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Submit listing for review"} <ArrowRight size={15} /></button>
      </form>
      <p className="form-help"><ShieldCheck size={15} /> Listings appear to other members after operations review.</p>
    </section>
  </div>;
}

function ParkingAdmin({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><p className="eyebrow eyebrow-muted">PARKING MARKETPLACE</p><h2>Member listings and permissions.</h2>
    <DataTable rows={rows} filtered={rows} columns={["title","ownerName","communityName","city","priceMinor","availableFrom","availableTo","status"]}
      actions={(row) => row.status === "DRAFT" ? <div className="row-actions">
        <button onClick={() => void onAction("parking.status", { id: row.id, status: "ACTIVE" }, "Parking listing approved and published.")}>Approve</button>
        <button className="danger-action" onClick={() => void onAction("parking.status", { id: row.id, status: "REJECTED" }, "Listing declined.")}>Decline</button>
      </div> : <Status value={row.status} />} />
  </div>;
}

function CarAdmin({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><p className="eyebrow eyebrow-muted">BUY & SELL</p><h2>Review marketplace listings.</h2>
    <DataTable rows={rows} filtered={rows} columns={["make","model","year","sellerName","sellerEmail","priceMinor","description","status"]}
      actions={(row) => row.status === "DRAFT" ? <div className="row-actions">
        <button onClick={() => void onAction("car.status", { id: row.id, status: "ACTIVE" }, "Car listing published.")}>Approve</button>
        <button className="danger-action" onClick={() => void onAction("car.status", { id: row.id, status: "REJECTED" }, "Car listing declined.")}>Decline</button>
      </div> : row.status === "ACTIVE" ? <button className="danger-action" onClick={() => void onAction("car.status", { id: row.id, status: "WITHDRAWN" }, "Listing withdrawn.")}>Withdraw listing</button> : <Status value={row.status} />} />
  </div>;
}

function RentalView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><p className="eyebrow eyebrow-muted">PARKING OPERATIONS</p><h2>Rental requests and bookings.</h2>
    <DataTable rows={rows} filtered={rows} columns={["title","ownerName","renterName","startsOn","endsOn","status","createdAt"]}
      actions={(row) => <RentalActions row={row} user={{ name: "", role: "ADMIN" } as SessionUser} onAction={onAction} />} />
  </div>;
}

function FinanceView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="finance-workspace">
    <section className="finance-note"><Wallet size={21} /><div><strong>Reconciliation is a deliberate step.</strong><span>Compare the submitted reference against the payment provider before marking a payment verified. The plan activates only after this action.</span></div></section>
    <div className="workspace-card"><p className="eyebrow eyebrow-muted">PAYMENTS & FINANCE</p><h2>Payment history & reconciliation.</h2>
      <DataTable rows={rows} filtered={rows} columns={["customerName","customerEmail","planName","amountMinor","currency","status","providerReference","createdAt"]}
        labels={{ amountMinor: "Amount", providerReference: "Provider reference" }}
        actions={(row) => row.status === "PENDING" ? <PaymentReview row={row} onAction={onAction} /> : <Status value={row.status} />} />
    </div>
  </div>;
}

function PaymentReview({ row, onAction }: { row: Row; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  const [reference, setReference] = useState(String(row.providerReference ?? ""));
  const [note, setNote] = useState("");
  return <form className="payment-review" onSubmit={(event) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const status = submitter instanceof HTMLButtonElement ? submitter.value : "PAID";
    void onAction("payment.reconcile", { id: row.id, status, providerReference: reference, verificationNote: note },
      `Payment marked ${status.toLowerCase()}.`);
  }}>
    <input value={reference} onChange={(event) => setReference(event.target.value)} required minLength={4} maxLength={160} placeholder="Provider reference" aria-label="Provider reference" />
    <input value={note} onChange={(event) => setNote(event.target.value)} required minLength={5} maxLength={500} placeholder="How was it verified?" aria-label="Verification note" />
    <button type="submit" value="PAID">Verify & activate</button>
    <button className="danger-action" type="submit" value="FAILED">Mark failed</button>
  </form>;
}

function NotificationsView({ rows, onAction }: { rows: Row[]; onAction: (action: string, values: Row, success: string) => Promise<boolean> }) {
  return <div className="workspace-card"><p className="eyebrow eyebrow-muted">YOUR UPDATES</p><h2>Every important note, in one place.</h2>
    {rows.length ? <div className="notification-list">{rows.map((row) => <article className={`notification-row ${row.readAt ? "" : "notification-unread"}`} key={String(row.id)}>
      <span className="notification-dot">{row.readAt ? <Check size={14} /> : <Bell size={14} />}</span><div><strong>{String(row.title)}</strong><p>{String(row.body)}</p><small>{formatDate(row.createdAt)}</small></div>
      {!row.readAt && <button className="text-action" onClick={() => void onAction("notification.read", { id: row.id }, "Notification marked read.")}>Mark read</button>}
    </article>)}</div> : <EmptyState icon={Bell} title="All caught up." text="Booking, payment, and service updates from the RIVORA team will appear here." />}
  </div>;
}

function DataTable({ title, rows, filtered, columns, labels = {}, actions, compact = false, query, setQuery }: {
  title?: string; rows: Row[]; filtered: Row[]; columns?: string[];
  labels?: Record<string, string>;
  actions?: (row: Row) => React.ReactNode;
  compact?: boolean; query?: string; setQuery?: (query: string) => void;
}) {
  const displayColumns = columns ?? Object.keys(rows[0] ?? {}).filter((key) => !hiddenKeys.has(key));
  return <div className={`data-table-wrap ${compact ? "data-table-compact" : ""}`}>
    {(title || setQuery) && <div className="data-table-heading">{title && <h3>{title}</h3>}
      {setQuery && <label className="table-search"><span className="sr-only">Search records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records…" /></label>}</div>}
    {filtered.length ? <div className="data-table-scroll"><table className="portal-data-table">
      <thead><tr>{displayColumns.map((column) => <th key={column}>{labels[column] ?? humanize(column)}</th>)}{actions && <th>Action</th>}</tr></thead>
      <tbody>{filtered.map((row, index) => <tr key={String(row.id ?? row.memberId ?? row.workDate ?? index)}>
        {displayColumns.map((column) => <td key={column}>{renderCell(column, row[column])}</td>)}
        {actions && <td>{actions(row)}</td>}
      </tr>)}</tbody>
    </table></div> : <EmptyState icon={WashingMachine} title={rows.length ? "No matching records." : "Nothing here just yet."} text={rows.length ? "Try a different search." : "New updates and records will appear here."} />}
  </div>;
}

function RecordCard({ row }: { row: Row }) {
  return <article className="record-card"><div><strong>{String(row.subject)}</strong><p>{String(row.description)}</p>
    {Boolean(row.resolution) && <small>{String(row.resolution)}</small>}<span>{formatDate(row.createdAt)}</span></div><Status value={row.status} /></article>;
}

function Status({ value }: { value: unknown }) {
  const label = String(value ?? "UNKNOWN");
  const state = ["ACTIVE", "COMPLETED", "PAID", "APPROVED", "RESOLVED", "CONFIRMED"].includes(label)
    ? "status-active" : ["PENDING", "REQUESTED", "ASSIGNED", "ARRIVED", "STARTED", "IN_PROGRESS", "REVIEWING", "DRAFT"].includes(label)
      ? "status-pending" : ["CANCELLED", "FAILED", "REFUNDED", "SUSPENDED", "MISSED", "REJECTED", "DECLINED", "ISSUE"].includes(label)
        ? "status-alert" : "status-neutral";
  return <span className={`status-pill ${state}`}><i />{humanize(label)}</span>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Gauge; title: string; text: string }) {
  return <div className="empty-state"><span><Icon size={21} /></span><h3>{title}</h3><p>{text}</p></div>;
}

function renderCell(key: string, value: unknown) {
  if (value == null || value === "") return <span className="muted-caption">—</span>;
  if (key === "status") return <Status value={value} />;
  if (moneyKeys.has(key)) return formatMoney(value, "INR");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date || key.endsWith("At") || key.endsWith("On")) return formatDate(value);
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && value.length > 140) return `${value.slice(0, 140)}…`;
  return String(value);
}

function formatMoney(value: unknown, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: currency.trim(), maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function formatDate(value: unknown) {
  if (!value) return "Date to be confirmed";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function humanize(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

async function uploadImage(file: File, use: "proof" | "listing") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("use", use);
  const response = await fetch("/api/portal/media", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok || typeof result.url !== "string") {
    throw new Error(result.error ?? "The image could not be uploaded.");
  }
  return result.url;
}

async function uploadImages(files: File[], use: "listing") {
  if (files.length > 8) throw new Error("Choose no more than eight photos.");
  const urls: string[] = [];
  for (const file of files) urls.push(await uploadImage(file, use));
  return urls;
}
