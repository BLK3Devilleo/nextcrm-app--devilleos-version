import { createAuthClient } from "better-auth/react";
import { emailOTPClient, adminClient } from "better-auth/client/plugins";
import { ac, admin, manager, user } from "@/lib/auth-permissions";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    emailOTPClient(),
    adminClient({
      ac,
      roles: { admin, manager, user },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
