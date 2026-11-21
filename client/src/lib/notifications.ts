import { getSupabase } from "@/lib/supabase";

export async function notifyUser(
  ownerId: string,
  kind: string,
  title: string,
  body: string
) {
  try {
    const client = await getSupabase();
    const { data: preferences, error: preferenceError } = await client
      .from("profiles")
      .select("notifications_enabled")
      .eq("id", ownerId)
      .maybeSingle();
    if (preferenceError || preferences?.notifications_enabled === false) return;
    const { error } = await client
      .from("notifications")
      .insert({ owner_id: ownerId, kind, title, body });
    if (!error && typeof window !== "undefined")
      window.dispatchEvent(new Event("app-notification-changed"));
  } catch {
    // Notification delivery is best-effort; it must not block a saved interview or study plan.
  }
}

export async function notifyWeeklyProgress(ownerId: string) {
  try {
    const client = await getSupabase();
    const { data: recent } = await client
      .from("notifications")
      .select("created_at")
      .eq("owner_id", ownerId)
      .eq("kind", "weekly_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      recent?.created_at &&
      Date.now() - new Date(recent.created_at).getTime() <
        6 * 24 * 60 * 60 * 1000
    )
      return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions, error } = await client
      .from("interview_sessions")
      .select("overall_score,status")
      .eq("owner_id", ownerId)
      .eq("status", "completed")
      .gte("created_at", since)
      .limit(100);
    if (error || !sessions?.length) return;
    const scores = sessions
      .map(session => Number(session.overall_score))
      .filter(Number.isFinite);
    const average = scores.length
      ? Math.round(
          scores.reduce((sum, value) => sum + value, 0) / scores.length
        )
      : null;
    const summary = `${sessions.length} completed practice session${sessions.length === 1 ? "" : "s"} in the last seven days${average === null ? "" : ` · ${average}% recent average`}. Keep focusing on one useful next step.`;
    await notifyUser(
      ownerId,
      "weekly_progress",
      "Your weekly practice signal",
      summary
    );
  } catch {
    // This optional reminder never interrupts practice.
  }
}
