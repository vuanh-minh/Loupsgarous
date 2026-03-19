import svgPaths from "./svg-p4j3u73qgb";

function Paragraph() {
  return (
    <div className="h-[14.389px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[15.6px] left-[170.93px] not-italic text-[#5a4a30] text-[10.4px] text-center top-[-0.77px] tracking-[0.0975px]">Confirmer votre choix ?</p>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[32.002px] relative shrink-0 w-[24.023px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-[12px] not-italic text-[#e8e0d4] text-[24px] text-center top-[-0.77px] tracking-[0.0703px]">🧔</p>
      </div>
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[20.395px] relative shrink-0 w-[57.71px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[20.4px] left-[29px] text-[#7a6a4a] text-[13.6px] text-center top-[-0.38px]">Joueur 1</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[32.002px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[7.998px] items-center justify-center relative size-full">
          <Text />
          <Text1 />
        </div>
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="absolute left-[53.18px] size-[13.994px] top-[12.01px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.9943 13.9943">
        <g id="Icon">
          <path d={svgPaths.p1a06f200} id="Vector" stroke="var(--stroke-0, #7A6A4A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
          <path d={svgPaths.p37a8c900} id="Vector_2" stroke="var(--stroke-0, #7A6A4A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[rgba(255,255,255,0.55)] flex-[1_0_0] h-[38.017px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(120,100,60,0.12)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Icon />
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.8px] left-[101.17px] text-[#7a6a4a] text-[11.2px] text-center top-[10.22px]">Annuler</p>
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="absolute left-[46.47px] size-[13.994px] top-[12.01px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.9943 13.9943">
        <g clipPath="url(#clip0_126_9293)" id="Icon">
          <path d={svgPaths.p89dd800} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
          <path d={svgPaths.p25091f80} id="Vector_2" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
        </g>
        <defs>
          <clipPath id="clip0_126_9293">
            <rect fill="white" height="13.9943" width="13.9943" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[rgba(160,120,8,0.08)] flex-[1_0_0] h-[38.017px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(160,120,8,0.25)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Icon1 />
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.8px] left-[101.46px] text-[#a07808] text-[11.2px] text-center top-[10.22px]">Confirmer</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="content-stretch flex gap-[7.998px] h-[38.017px] items-start relative shrink-0 w-full" data-name="Container">
      <Button />
      <Button1 />
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-[#e8dfc7] content-stretch flex flex-col gap-[11.992px] items-start pb-[0.616px] pt-[16.612px] px-[16.612px] relative rounded-[14px] size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(160,120,8,0.25)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Paragraph />
      <Container1 />
      <Container2 />
    </div>
  );
}