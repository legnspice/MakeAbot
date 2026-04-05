"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "disclaimer_accepted_v1";

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  // Default true to avoid a flash of the modal on returning visits
  const [accepted, setAccepted] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setAccepted(false);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
    onAccept?.();
  }

  if (accepted) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm text-center mx-auto sm:mx-3 px-8"
      >
        <DialogHeader>
          <DialogTitle className="text-center  ">
            Just a quick disclaimer...
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-3 mb-5">
          <p>
            MakeAbot is an independent, student-led initiative designed to help
            students connect to offer and request items and services. It is not
            officially affiliated with, maintained by, or endorsed by Ateneo.
          </p>
          <p>
            We simply provide the communication platform; we do not oversee the
            actual transactions. By using this app, you acknowledge that all
            exchanges are made at your own risk. The creators and administrators
            of this app are not responsible or liable for any disputes,
            financial losses, or property damage resulting from interactions or
            transactions initiated through this platform. Please exercise
            caution and common sense accordingly.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleAccept} className="w-full">
            I understand, continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
