"use client";

import { GooeyToaster } from "goey-toast";

export function Toaster() {
  return (
    <GooeyToaster
      position="bottom-right"
      preset="bouncy"
      swipeToDismiss
      closeOnEscape
    />
  );
}
