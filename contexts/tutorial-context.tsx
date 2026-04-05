"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";

export const TUTORIAL_STORAGE_KEY = "tutorial_seen_v1";

interface TutorialContextValue {
  isOpen: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      openTutorial: () => setIsOpen(true),
      closeTutorial: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
}
