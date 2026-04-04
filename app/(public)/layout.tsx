"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { AppFooter } from "@/components/app-footer";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { userData, currentUserDataLoading } = useCurrentUser();

  useEffect(() => {
    if (!currentUserDataLoading && !userData) {
      router.push("/auth/login");
    }
  }, [userData, currentUserDataLoading, router]);

  if (currentUserDataLoading) {
    return <PageShellSkeleton />;
  }

  if (!userData) {
    return null;
  }

  return (
    <AuthProvider userData={userData}>
      <div className="flex flex-col min-h-screen">
        <DisclaimerModal />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
    </AuthProvider>
  );
}
