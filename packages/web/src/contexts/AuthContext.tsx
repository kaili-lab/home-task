import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { getCurrentUser } from "@/services/users.api";
import type { UserInfo } from "shared";

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending: sessionLoading } = useSession();
  const queryClient = useQueryClient();

  // 查询用户信息（仅在已登录时）
  const {
    data: user,
    isPending: userLoading,
    error,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    enabled: !!session?.user, // 仅在已登录时查询
    retry: false,
    staleTime: 1000 * 60 * 5, // 5分钟
  });

  const isLoading = sessionLoading || (!!session?.user && userLoading);
  const isAuthenticated = !!session?.user && !!user && !error;

  const signOut = async () => {
    const { authClient } = await import("@/lib/auth-client");
    await authClient.signOut();
    // 清除所有查询缓存
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
