"use client";

import { AdsInputModal } from "@/components/ads-input-modal";
import type { AdsInputModalProps } from "@/components/ads-input-modal";

type DropiAdsModalProps = Omit<AdsInputModalProps, "apiEndpoint">;

export function DropiAdsModal(props: DropiAdsModalProps) {
  return <AdsInputModal {...props} apiEndpoint="/api/dropi/ads" />;
}
