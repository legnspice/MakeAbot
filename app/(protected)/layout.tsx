"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import {
  TutorialProvider,
  useTutorial,
  TUTORIAL_STORAGE_KEY,
} from "@/contexts/tutorial-context";
import { TutorialModal } from "@/components/tutorial-modal";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { openTutorial } = useTutorial();

  function handleDisclaimerAccept() {
    if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
      openTutorial();
    }
  }

  return (
    <>
      <DisclaimerModal onAccept={handleDisclaimerAccept} />
      <TutorialModal />
      {children}
    </>
  );
}

// Layout level auth requirement for accessing protected pages
export default function ProtectedLayout({
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

  // Show loading state while checking auth
  if (currentUserDataLoading) {
    return <PageShellSkeleton />;
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!userData) {
    return null;
  }

  return (
    <TutorialProvider>
      <AuthProvider userData={userData}>
        <ProtectedContent>{children}</ProtectedContent>
      </AuthProvider>
    </TutorialProvider>
  );
}
