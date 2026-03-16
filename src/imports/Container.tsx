import svgPaths from "./svg-20utbdqw20";

function Text() {
  return (
    <div className="h-[27.998px] relative shrink-0 w-[19.711px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-0 not-italic text-[#2a1f10] text-[20px] top-[-0.15px] tracking-[-0.4492px]">🧕</p>
      </div>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[17.998px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-0 text-[#a07808] text-[12px] top-[-0.38px]">Voter contre Joueur 17 ?</p>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[13.195px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[13.2px] left-0 not-italic text-[#7a6a4a] text-[8.8px] top-[0.23px] tracking-[0.1759px]">Confirmez votre choix ou selectionnez un autre joueur</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="flex-[1_0_0] h-[33.59px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2.397px] items-start relative size-full">
        <Paragraph />
        <Paragraph1 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex gap-[11.992px] h-[33.59px] items-center relative shrink-0 w-full" data-name="Container">
      <Text />
      <Container2 />
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

function Container3() {
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
      <div aria-hidden="true" className="absolute border border-[rgba(160,120,8,0.25)] border-solid inset-0 pointer-events-none rounded-[14px] shadow-[0px_2px_10px_0px_rgba(140,133,120,0.5)]" />
      <Container1 />
      <Container3 />
    </div>
  );
}