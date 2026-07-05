"use client";

export type CountrySelectTab = "popular" | "multi";

type Props = {
  active: CountrySelectTab;
  onChange: (tab: CountrySelectTab) => void;
};

/** usimsa `.el-tabs` — 인기국가 / 다국가 */
export function CountrySelectTabs({ active, onChange }: Props) {
  const tabs: { id: CountrySelectTab; label: string }[] = [
    { id: "popular", label: "인기국가" },
    { id: "multi", label: "다국가" },
  ];

  return (
    <div className="border-b border-[#f0f0f6] bg-white" role="tablist" aria-label="국가 유형">
      <div className="flex h-[44px]">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center text-[15px] tracking-[-0.4px] transition ${
                isActive
                  ? "border-b-2 border-[#0176f9] font-semibold text-[#0176f9]"
                  : "border-b-2 border-transparent font-normal text-[#767676] hover:text-[#222]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
