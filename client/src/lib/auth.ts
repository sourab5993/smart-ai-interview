import { clearUserDrafts } from "./safeStorage";

type SignOutAuth = { signOut: () => Promise<{ error: unknown }> };

/** Wrap Supabase sign-out so auth UI can report one safe, non-provider-specific error. */
export async function signOutSupabase(auth: SignOutAuth): Promise<void> {
  const { error } = await auth.signOut();
  if (error)
    throw new Error(
      "We couldn't complete sign out. Check your connection and try again."
    );
  clearUserDrafts();
}
