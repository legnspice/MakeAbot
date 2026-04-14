"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BellFill } from "react-bootstrap-icons";

export const PUSH_PROMPT_KEY = "push_prompt_seen";

interface PushPermissionModalProps {
  onEnable: () => void;
  onSkip: () => void;
}

export function PushPermissionModal({
  onEnable,
  onSkip,
}: PushPermissionModalProps) {
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
