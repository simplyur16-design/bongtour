"use client";

import { useState } from "react";
import { DeviceCheckCard } from "@/components/bongsim/DeviceCheckCard";
import { DeviceCompatibilityModal } from "@/components/bongsim/DeviceCompatibilityModal";
import { HelpSupportDetailLayout } from "@/components/bongsim/HelpSupportDetailLayout";

export function HelpDeviceCompatibilityPageClient() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HelpSupportDetailLayout
        currentPath="/help/device-compatibility"
        title="이용 가능 기기 다시 확인"
        intro="EID 표시 여부와 기종 예시를 다시 확인해요. 개통 전에 꼭 한 번 살펴보세요."
      >
        <DeviceCheckCard onClick={() => setOpen(true)} />
        <p className="mt-6 text-[12px] leading-relaxed text-slate-500">
          위 카드를 누르면 호환 기기 목록을 볼 수 있어요.
        </p>
      </HelpSupportDetailLayout>
      <DeviceCompatibilityModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
