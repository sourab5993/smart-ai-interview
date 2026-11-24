import { trpc } from "@/lib/trpc";
import { currentAccessToken } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { SupabaseAuthProvider } from "./contexts/SupabaseAuthContext";
import "./index.css";
import "./theme.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
  },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const token = await currentAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      async fetch(input, init) {
        try {
          return await globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        } catch (fetchErr: any) {
          const raw = fetchErr?.message || String(fetchErr || "");
          if (/failed to fetch|networkerror|load failed/i.test(raw)) {
            await new Promise(r => setTimeout(r, 450));
            return await globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
          }
          throw fetchErr;
        }
      },
    }),
  ],
});

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
