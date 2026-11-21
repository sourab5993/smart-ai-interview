import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Command,
  FileSearch,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Network,
  Search,
  Settings,
  Shield,
  Target,
  X,
} from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { recordWorkspaceActivity } from "@/lib/activity";
import { getSupabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const nav = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/app", icon: LayoutDashboard },
      { label: "Practice interview", href: "/practice", icon: Mic2 },
    ],
  },
  {
    label: "Prepare",
    items: [
      { label: "Question bank", href: "/questions", icon: BookOpen },
      { label: "Resume analyzer", href: "/resume", icon: FileSearch },
      { label: "Skill gaps", href: "/skill-gap", icon: Target },
      { label: "Study plan", href: "/study-plan", icon: GraduationCap },
    ],
  },
  {
    label: "Progress",
    items: [
      { label: "Performance", href: "/performance", icon: ChartNoAxesCombined },
      { label: "Interview history", href: "/history", icon: ClipboardList },
      { label: "Bookmarks", href: "/bookmarks", icon: Activity },
      { label: "Project insights", href: "/project-insights", icon: Network },
    ],
  },
];
const mobile = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Practice", href: "/practice", icon: Mic2 },
  { label: "Questions", href: "/questions", icon: BookOpen },
  { label: "Progress", href: "/performance", icon: ChartNoAxesCombined },
  { label: "Profile", href: "/settings", icon: Settings },
];
const titles: Record<string, string> = {
  "/app": "Dashboard",
  "/practice": "Practice interview",
  "/questions": "Question bank",
  "/resume": "Resume analyzer",
  "/performance": "Performance",
  "/skill-gap": "Skill gap",
  "/study-plan": "Study plan",
  "/history": "Interview history",
  "/bookmarks": "Bookmarks",
  "/project-insights": "Project Insights",
  "/settings": "Settings",
  "/admin": "Admin console",
  "/onboarding": "Your profile",
};
export default function AppShell({ children }: { children: ReactNode }) {
  const [path, setPath] = useLocation();
  const { user, logout } = useSupabaseAuth();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLElement>(null);
  const notificationWasOpen = useRef(false);
  const [catalogNeedsSetup, setCatalogNeedsSetup] = useState(false);
  const admin = trpc.admin.access.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    staleTime: 300_000,
  });
  useEffect(() => {
    if (user?.id) void recordWorkspaceActivity(user.id);
  }, [user?.id]);
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setNotificationsLoading(true);
    try {
      const client = await getSupabase();
      const [recent, unread] = await Promise.all([
        client.from("notifications").select("id,title,body,created_at,read_at")
          .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(6),
        client.from("notifications").select("id", { count: "exact", head: true })
          .eq("owner_id", user.id).is("read_at", null),
      ]);
      if (recent.error || unread.error) throw recent.error || unread.error;
      setNotifications(recent.data || []);
      setUnreadCount(unread.count ?? 0);
      setNotificationsError(false);
    } catch {
      setNotificationsError(true);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    if (notificationsOpen) void loadNotifications();
  }, [notificationsOpen, loadNotifications]);
  useEffect(() => {
    if (notificationsOpen) {
      notificationWasOpen.current = true;
      const panel = notificationPanelRef.current;
      (panel?.querySelector<HTMLElement>("button:not([disabled])") || panel)?.focus();
    } else if (notificationWasOpen.current) {
      notificationWasOpen.current = false;
      notificationTriggerRef.current?.focus();
    }
  }, [notificationsOpen]);
  useEffect(() => {
    const refresh = () => { if (notificationsOpen) void loadNotifications(); };
    window.addEventListener("app-notification-changed", refresh);
    return () => window.removeEventListener("app-notification-changed", refresh);
  }, [notificationsOpen, loadNotifications]);
  useEffect(() => {
    let active = true;
    async function checkCatalog() {
      if (!userId) {
        setCatalogNeedsSetup(false);
        return;
      }
      try {
        const c = await getSupabase();
        const { count, error } = await c
          .from("course_categories")
          .select("id", { count: "exact", head: true })
          .limit(1);
        if (!active) return;
        setCatalogNeedsSetup(Boolean(error) || (count ?? 0) === 0);
      } catch {
        if (active) setCatalogNeedsSetup(false);
      }
    }
    void checkCatalog();
    return () => {
      active = false;
    };
  }, [userId]);
  const title =
    Object.entries(titles).find(
      ([key]) => path === key || path.startsWith(`${key}/`)
    )?.[1] || "Workspace";
  async function leave() {
    try {
      await logout();
      setPath("/");
    } catch {
      toast.error("We couldn't sign out. Check your connection and try again.");
    }
  }
  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    setPath(
      search.trim()
        ? `/questions?search=${encodeURIComponent(search.trim())}`
        : "/questions"
    );
    setOpen(false);
  }
  async function markNotificationRead(id: string) {
    if (!user?.id) return;
    try {
      const client = await getSupabase();
      const readAt = new Date().toISOString();
      const { error } = await client.from("notifications").update({ read_at: readAt })
        .eq("id", id).eq("owner_id", user.id).is("read_at", null);
      if (error) throw error;
      setNotifications(rows => rows.map(row => row.id === id ? { ...row, read_at: readAt } : row));
      setUnreadCount(count => count === null ? null : Math.max(0, count - 1));
      window.dispatchEvent(new Event("app-notification-changed"));
    } catch {
      toast.error("That notification couldn't be updated.");
    }
  }
  async function markAllNotificationsRead() {
    if (!user?.id) return;
    try {
      const client = await getSupabase();
      const readAt = new Date().toISOString();
      const { error } = await client.from("notifications").update({ read_at: readAt })
        .eq("owner_id", user.id).is("read_at", null);
      if (error) throw error;
      setNotifications(rows => rows.map(row => ({ ...row, read_at: row.read_at || readAt })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("app-notification-changed"));
    } catch {
      toast.error("We couldn't mark all notifications as read.");
    }
  }
  const initials = (
    (user?.user_metadata?.full_name as string) ||
    user?.email ||
    "S"
  )
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link href="/app" className="brand sidebar-brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            <b>SMART INTERVIEW</b>
          </span>
        </Link>
        <div className="sidebar-profile">
          <div className="avatar avatar-blue">{initials || "S"}</div>
          <div className="sidebar-profile-copy">
            <b>{user?.user_metadata?.full_name || "Your workspace"}</b>
            <span>Candidate account</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {nav.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(item => {
                const active =
                  path === item.href ||
                  (item.href !== "/app" && path.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`nav-item ${active ? "active" : ""}`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {item.href === "/practice" && (
                      <span className="nav-new">AI</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-lower">
          <div className="readiness-mini">
            <div className="readiness-mini-top">
              <span className="secure-dot" /> COACH STATUS
            </div>
            <b>Ready when you are</b>
            <span>Pick a skill. Make one clear step.</span>
            <Link href="/practice" className="mini-link">
              Start a session <ArrowUpRight size={13} />
            </Link>
          </div>
          {admin.data?.allowed && (
            <Link
              className={`nav-item ${path === "/admin" ? "active" : ""}`}
              href="/admin"
              onClick={() => setOpen(false)}
            >
              <Shield size={17} />
              <span>Admin console</span>
            </Link>
          )}
          <Link
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
            href="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button className="nav-item signout" onClick={() => void leave()}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
        <div className="sidebar-foot">
          <span>SMART INTERVIEW</span>
        </div>
      </aside>
      {open && (
        <button
          className="mobile-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="page-context">
            <span className="page-context-root">Workspace</span>
            <span className="crumb-slash">/</span>
            <b>{title}</b>
          </div>
          <form className="topbar-search global-search" onSubmit={doSearch}>
            <Search size={15} />
            <input
              placeholder="Search questions, skills…"
              aria-label="Search questions and skills"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <kbd>
              <Command size={10} /> K
            </kbd>
          </form>
          <div className="topbar-right">
            <span className="ai-online">
              <span /> AI online
            </span>
            <div className="topbar-bell">
              <button
                type="button"
                ref={notificationTriggerRef}
                id="workspace-notification-trigger"
                className="icon-button notification-trigger"
                aria-label={unreadCount === null ? "Notifications" : `Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-controls="workspace-notifications"
                onClick={() => setNotificationsOpen(value => !value)}
              >
                <Bell size={17} />
                {unreadCount !== null && unreadCount > 0 && <i aria-hidden="true" />}
              </button>
              {notificationsOpen && (
                <section
                  ref={notificationPanelRef}
                  id="workspace-notifications"
                  className="notification-popover"
                  role="dialog"
                  aria-label="Recent notifications"
                  tabIndex={-1}
                  onKeyDown={event => { if (event.key === "Escape") setNotificationsOpen(false); }}
                >
                  <header className="notification-popover-header">
                    <div><b>Notifications</b><span>{unreadCount === null ? "Your recent updates" : `${unreadCount} unread`}</span></div>
                    {Boolean(unreadCount) && <button type="button" className="button button-ghost" onClick={() => void markAllNotificationsRead()}>Mark all read</button>}
                  </header>
                  {notificationsLoading ? <p className="notification-popover-empty" role="status">Loading your updates…</p>
                    : notificationsError ? <p className="notification-popover-empty" role="alert">Notifications are unavailable right now.</p>
                    : !notifications.length ? <p className="notification-popover-empty">You're all caught up.</p>
                    : <div className="notification-popover-list">{notifications.map(item => (
                      <article key={item.id} className={`notification-popover-item ${item.read_at ? "" : "unread"}`}>
                        <div><b>{item.title}</b><p>{item.body}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>
                        {!item.read_at && <button type="button" className="button button-ghost" onClick={() => void markNotificationRead(item.id)}>Mark read</button>}
                      </article>
                    ))}</div>}
                </section>
              )}
            </div>
            <Link href="/settings" className="topbar-user">
              <span className="avatar avatar-small">{initials || "S"}</span>
              <span>
                {user?.user_metadata?.full_name ||
                  user?.email?.split("@")[0] ||
                  "Account"}
              </span>
              <ChevronDown size={13} />
            </Link>
          </div>
        </header>
        <main className="workspace-content">
          {catalogNeedsSetup && (
            <div className="database-setup-notice" role="status">
              <b>Supabase app data is not initialized.</b> The project owner
              must run migration files 202610140001–202610140007 in order before
              catalogs, interviews and saved progress are available.
            </div>
          )}
          {children}
        </main>
      </div>
      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile workspace navigation"
      >
        {mobile.map(item => {
          const Icon = item.icon;
          const active =
            path === item.href ||
            (item.href !== "/app" && path.startsWith(item.href));
          return (
            <Link
              href={item.href}
              key={item.href}
              className={active ? "active" : ""}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
