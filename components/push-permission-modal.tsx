"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BellFill, BoxArrowUp } from "react-bootstrap-icons";
import { useState } from "react";
import { needsIosInstall } from "@/lib/pwa";

export const PUSH_PROMPT_KEY = "push_prompt_seen";

interface PushPermissionModalProps {
  onEnable: () => void;
  onSkip: () => void;
}

export function PushPermissionModal({
  onEnable,
  onSkip,
}: PushPermissionModalProps) {
  // Lazy init — the checks read navigator/window, and this modal is only ever
  // mounted client-side in response to a user action.
  const [iosInstall] = useState(() => needsIosInstall());

  if (iosInstall) {
    return (
      <Dialog open={true}>
        <DialogContent className="max-w-sm text-center mx-auto sm:mx-3 px-8">
          <DialogHeader>
            <DialogTitle className="text-center flex flex-col justify-center items-center">
              <BoxArrowUp className="mb-3" size={24} />
              Add MakeAbot to your Home Screen
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3 mb-5">
            <p>
              iPhone only allows notifications for installed apps. Tap{" "}
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <BoxArrowUp size={14} /> Share
              </span>{" "}
              in Safari, then{" "}
              <span className="font-medium text-foreground">
                Add to Home Screen
              </span>
              .
            </p>
            <p>
              Until then you&apos;ll still see everything in the app and in your
              daily email summary.
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={onSkip} className="w-full">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-sm text-center mx-auto sm:mx-3 px-8">
        <DialogHeader>
          <DialogTitle className="text-center flex flex-col justify-center items-center">
            <BellFill className="mb-3" size={24} />
            Stay in the loop
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-3 mb-5">
          <p>
            Get notified when someone bids on your post or messages you — even
            when the app is closed.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={onEnable} className="w-full">
            Enable notifications
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
