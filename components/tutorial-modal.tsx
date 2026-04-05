"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Plus, MessageCircle, ListChecks, Bell } from "lucide-react";
import { useTutorial, TUTORIAL_STORAGE_KEY } from "@/contexts/tutorial-context";

const STEPS = [
  {
    icon: LayoutGrid,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Welcome to MakeAbot!",
    body: "Your student marketplace for sharing and finding items within the Ateneo community. Here's a quick tour to get you started.",
  },
  {
    icon: LayoutGrid,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Browse the Feed",
    body: "Scroll through what your fellow Ateneans are offering and requesting. Use the filter bar to switch between Offers, Requests, or search by keyword.",
  },
  {
    icon: Plus,
    iconBg: "bg-amber-100",
    iconColor: "text-[#E5A550]",
    title: "Create a Post",
    body: "Tap the amber Create button to post something you want to offer or something you need.",
  },
  {
    icon: MessageCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Inquire on an Item",
    body: "Tap any card, then hit Inquire to open a direct chat with the poster.",
  },
  {
    icon: ListChecks,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Track Your Chats",
    body: "Head to the Tracker tab to see all your active conversations and follow up on negotiations.",
  },
  {
    icon: Bell,
    iconBg: "bg-amber-100",
    iconColor: "text-[#E5A550]",
    title: "Notifications",
    body: "You'll be notified when someone inquires on your post or sends you a message. Check the notification bell to stay up to date.",
  },
] as const;

export function TutorialModal() {
  const { isOpen, closeTutorial } = useTutorial();
  const [step, setStep] = useState(0);

  function handleClose() {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    setStep(0);
    closeTutorial();
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm text-center mx-auto sm:mx-3 px-8"
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-2 mb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-[#3761B0]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <DialogHeader className="items-center gap-3">
          {step === 0 ? (
            <Image src="/logo.svg" alt="MakeAbot" width={80} height={80} />
          ) : (
            <div
              className={`w-16 h-16 rounded-full ${current.iconBg} flex items-center justify-center`}
            >
              <Icon className={`w-8 h-8 ${current.iconColor}`} strokeWidth={2} />
            </div>
          )}
          <DialogTitle className="text-center text-lg font-bold text-gray-800">
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-5 min-h-[4rem]">
          {current.body}
        </p>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted-foreground hover:text-gray-700 transition-colors"
          >
            Skip tutorial
          </button>
          <Button onClick={handleNext} className="min-w-[90px]">
            {isLastStep ? "Got it" : "Next →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
