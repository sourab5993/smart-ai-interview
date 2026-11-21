import { getSupabase } from "@/lib/supabase";

/**
 * Record a privacy-minimal, account-owned daily workspace visit. Failures are
 * intentionally non-blocking so analytics can never interrupt core practice.
 */
export async function recordWorkspaceActivity(ownerId: string) {
  if (!ownerId) return;
  try {
    const client = await getSupabase();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count, error: lookupError } = await client
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("event_type", "workspace_opened")
      .gte("created_at", dayStart.toISOString());
    if (lookupError || (count ?? 0) > 0) return;
    await client.from("activity_logs").insert({
      owner_id: ownerId,
      event_type: "workspace_opened",
      metadata: {},
    });
  } catch {
    // The dashboard remains usable if telemetry or the database is unavailable.
  }
}
