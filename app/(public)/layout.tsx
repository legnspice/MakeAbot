"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { TutorialProvider, useTutorial, TUTORIAL_STORAGE_KEY } from "@/contexts/tutorial-context";
import { TutorialModal } from "@/components/tutorial-modal";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { AppFooter } from "@/components/app-footer";

function PublicContent({ children }: { children: React.ReactNode }) {
  const { openTutorial } = useTutorial();

  function handleDisclaimerAccept() {
    if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
      openTutorial();
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DisclaimerModal onAccept={handleDisclaimerAccept} />
      <TutorialModal />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}

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
    <TutorialProvider>
      <AuthProvider userData={userData}>
        <PublicContent>{children}</PublicContent>
      </AuthProvider>
    </TutorialProvider>
  );
}
