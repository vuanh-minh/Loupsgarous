import svgPaths from "./svg-2ey97mm1p3";

function Icon() {
  return (
    <div className="relative shrink-0 size-[13.994px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.9943 13.9943">
        <g id="Icon">
          <path d={svgPaths.p28ad87f1} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
          <path d={svgPaths.p3cc92f00} id="Vector_2" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
        </g>
      </svg>
    </div>
  );
}

export default function TextInput() {
  return (
    <div className="bg-[rgba(255,255,255,0.5)] relative rounded-[10px] size-full" data-name="Text Input">
      <div className="content-stretch flex gap-[8px] items-center overflow-clip px-[12px] py-[8px] relative rounded-[inherit] size-full">
        <Icon />
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[12px] text-[rgba(42,31,16,0.5)] whitespace-nowrap">Rechercher un joueur...</p>
      </div>
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(120,100,60,0.15)] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}