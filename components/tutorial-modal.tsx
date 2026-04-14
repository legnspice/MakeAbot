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
import {
  GridFill,
  PlusLg,
  ChatDotsFill,
  ListCheck,
  BellFill,
  EnvelopeExclamationFill,
  PencilSquare,
} from "react-bootstrap-icons";
import { useTutorial, TUTORIAL_STORAGE_KEY } from "@/contexts/tutorial-context";
import Link from "next/link";

const STEPS = [
  {
    icon: GridFill,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Welcome to MakeAbot!",
    body: "Your student app for sharing and finding items within the Ateneo community. Here's a quick tour to get you started.",
  },
  {
    icon: GridFill,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Browse the Feed",
    body: "Scroll through what your fellow Ateneans are offering and requesting. Use the filter bar to switch between Offers, Requests, or search by keyword.",
  },
  {
    icon: PlusLg,
    iconBg: "bg-amber-100",
    iconColor: "text-[#DEA440]",
    title: "Create a Post",
    body: "Tap the Create button below to post something you want to offer or something you need.",
  },
  {
    icon: ChatDotsFill,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Inquire on an Item",
    body: "Tap any card, then hit Inquire to open a direct chat with the poster.",
  },
  {
    icon: ListCheck,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Track Your Chats",
    body: "Head to the Tracker tab to see all your active conversations and follow up on negotiations.",
  },
  {
    icon: BellFill,
    iconBg: "bg-amber-100",
    iconColor: "text-[#DEA440]",
    title: "Notifications",
    body: "You'll be notified when someone inquires on your post or sends you a message. Check the notification bell to stay up to date.",
  },
  {
    icon: PencilSquare,
    iconBg: "bg-amber-100",
    iconColor: "text-[#DEA440]",
    title: "Profile",
    body: "Build trust and rapport with others by having your profile information up to date. Go into the Profile tab and click the edit profile button there.",
  },
  {
    icon: EnvelopeExclamationFill,
    iconBg: "bg-amber-100",
    iconColor: "text-[#DEA440]",
    title: "Contact Us!",
    body: "",
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

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1);
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
            <div className="w-16 h-16 flex items-center justify-center">
              <Image src="/logo.svg" alt="MakeAbot" width={64} height={64} />
            </div>
          ) : (
            <div
              className={`w-16 h-16 rounded-full ${current.iconBg} flex items-center justify-center`}
            >
              <Icon className={current.iconColor} size={32} />
            </div>
          )}
          <DialogTitle className="text-center text-lg font-bold text-gray-800">
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground max-w-xs mx-auto mb-5 min-h-[4rem]">
          {isLastStep ? (
            <div>
              Need more help or have any specific concerns? Message us at{" "}
              <Link
                href="https://www.facebook.com/people/MakeAbot/61575401159655/"
                className="font-bold text-blue-500"
              >
                Facebook
              </Link>{" "}
              or send an email to niles.tristan.cabrera@student.ateneo.edu!
            </div>
          ) : (
            current.body
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted-foreground hover:text-gray-700 transition-colors"
          >
            Skip tutorial
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="min-w-[90px]"
              >
                ← Back
              </Button>
            )}
            <Button onClick={handleNext} className="min-w-[90px]">
              {isLastStep ? "Got it" : "Next →"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
