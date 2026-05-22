import { type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { getCurrentUser } from "@/services/users.api";
import { AuthContext } from "@/contexts/auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending: sessionLoading } = useSession();
  const queryClient = useQueryClient();

  const {
    data: user,
    isPending: userLoading,
    error,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    enabled: !!session?.user,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = sessionLoading || (!!session?.user && userLoading);
  const isAuthenticated = !!session?.user && !!user && !error;

  const signOut = async () => {
    const { authClient } = await import("@/lib/auth-client");
    await authClient.signOut();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
