"use client";

import { use, createContext, type PropsWithChildren } from "react";

import { authClient } from "@/lib/auth-client";

const AuthContext = createContext<{
  signIn: () => void;
  signOut: () => void;
  session: typeof authClient.$Infer.Session.session | null;
  user: typeof authClient.$Infer.Session.user | null;
  isLoading: boolean;
}>({
  signIn: () => null,
  signOut: () => null,
  session: null,
  user: null,
  isLoading: true,
});

export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useSession must be wrapped in a <SessionProvider />");
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const { data, isPending } = authClient.useSession();

  return (
    <AuthContext.Provider
      value={{
        signIn: () => {
          // Handled in the auth screen
        },
        signOut: () => {
          authClient.signOut();
        },
        session: data?.session ?? null,
        user: data?.user ?? null,
        isLoading: isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
