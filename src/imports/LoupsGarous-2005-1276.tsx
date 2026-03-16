import svgPaths from "./svg-gzknvqas7q";
import imgImg from "figma:asset/a82839620a1569fcbf0c2b77dd03b73637aa89ad.png";

function Section() {
  return <div className="absolute h-0 left-[-250px] top-0 w-[1059.484px]" data-name="Section" />;
}

function Img() {
  return (
    <div className="absolute h-[896.866px] left-0 top-0 w-[559.993px]" data-name="img">
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImg} />
    </div>
  );
}

function Container1() {
  return <div className="absolute bg-gradient-to-b from-[rgba(0,0,0,0.3)] h-[896.866px] left-0 to-[rgba(0,0,0,0.6)] top-0 via-[40%] via-[rgba(0,0,0,0.45)] w-[559.993px]" data-name="Container" />;
}

function Container() {
  return (
    <div className="absolute h-[896.866px] left-0 top-0 w-[559.993px]" data-name="Container">
      <Img />
      <Container1 />
    </div>
  );
}

function Span() {
  return (
    <div className="h-[21.001px] relative shrink-0 w-[14.168px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[21px] left-0 not-italic text-[#2a1f10] text-[14px] top-[-0.15px] tracking-[-0.1504px]">⭐️</p>
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="h-[22.493px] relative shrink-0 w-[130.212px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[22.5px] left-0 text-[#d4a843] text-[15px] top-[-0.38px]">Qui se presente ?</p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="absolute content-stretch flex gap-[9.99px] h-[22.493px] items-center left-0 top-[310.36px] w-[520.002px]" data-name="Container">
      <Span />
      <Span1 />
    </div>
  );
}

function P() {
  return (
    <div className="h-[17.998px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[239.4px] not-italic text-[12px] text-center text-white top-[0.85px]">Aucun candidat pour le moment. Presentez-vous ci-dessous !</p>
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.33)] content-stretch flex flex-col h-[59.211px] items-start left-0 pb-[0.616px] pt-[20.606px] px-[20.606px] rounded-[16.5px] top-[352.84px] w-[520.002px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(0,0,0,0.06)] border-solid inset-0 pointer-events-none rounded-[16.5px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]" />
      <P />
    </div>
  );
}

function Span2() {
  return (
    <div className="h-[49.991px] relative shrink-0 w-full" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[50px] left-[191.15px] not-italic text-[#2a1f10] text-[45px] text-center top-[0.15px] tracking-[0.3625px]">🏛️</p>
    </div>
  );
}

function H() {
  return (
    <div className="h-[33.003px] relative shrink-0 w-full" data-name="h2">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[33px] left-[191.71px] text-[#d4a843] text-[22px] text-center top-[0.23px]">Election du Maire</p>
    </div>
  );
}

function P1() {
  return (
    <div className="h-[19.5px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[19.5px] left-[191.5px] not-italic text-[13px] text-[rgba(255,255,255,0.6)] text-center top-[0.85px] tracking-[-0.0762px]">Votez pour elire le Maire du village. Son vote comptera double !</p>
    </div>
  );
}

function Div3() {
  return (
    <div className="content-stretch flex flex-col gap-[9.99px] h-[122.474px] items-start relative shrink-0 w-[382.283px]" data-name="div">
      <Span2 />
      <H />
      <P1 />
    </div>
  );
}

function MotionDiv2() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.3)] h-[155.698px] left-0 rounded-[16.5px] top-[35.22px] w-[520.002px]" data-name="motion.div">
      <div className="content-stretch flex flex-col items-center overflow-clip pb-[0.616px] pt-[16.612px] px-[16.612px] relative rounded-[inherit] size-full">
        <Div3 />
      </div>
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[16.5px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]" />
    </div>
  );
}

function Div2() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[520.002px]" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <MotionDiv2 />
      </div>
    </div>
  );
}

function MotionDiv1() {
  return (
    <div className="absolute content-stretch flex flex-col h-[190.915px] items-start left-0 top-0 w-[520.002px]" data-name="motion.div">
      <Div2 />
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute h-[190.915px] left-0 top-[106px] w-[520.002px]" data-name="Container">
      <MotionDiv1 />
    </div>
  );
}

function MotionP() {
  return (
    <div className="absolute h-[58.99px] left-0 top-0 w-[163.1px]" data-name="motion.p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Black',sans-serif] font-black leading-[58.986px] left-[82px] text-[58.986px] text-center text-white top-[0.53px]">04:55</p>
    </div>
  );
}

function P2() {
  return (
    <div className="absolute h-[18.431px] left-0 top-[70.98px] w-[163.1px]" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18.433px] left-[81.96px] text-[12.289px] text-[rgba(255,255,255,0.9)] text-center top-[-0.38px] tracking-[1.5px] uppercase">Votez pour le maire</p>
    </div>
  );
}

function P3() {
  return (
    <div className="absolute h-[14.995px] left-0 top-[95.41px] w-[163.1px]" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[15px] left-[81.91px] text-[10px] text-[rgba(255,255,255,0.6)] text-center top-[-0.38px]">0 / 7 votes</p>
    </div>
  );
}

function Div5() {
  return (
    <div className="absolute h-[110.405px] left-[144.23px] top-[31.99px] w-[163.1px]" data-name="div">
      <MotionP />
      <P2 />
      <P3 />
    </div>
  );
}

function MotionDiv4() {
  return (
    <div className="absolute h-[158.393px] left-0 overflow-clip top-0 w-[451.561px]" data-name="motion.div">
      <Div5 />
    </div>
  );
}

function Div4() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[451.561px]" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <MotionDiv4 />
      </div>
    </div>
  );
}

function MotionDiv3() {
  return (
    <div className="absolute content-stretch flex flex-col h-[158.393px] items-start left-0 top-0 w-[451.561px]" data-name="motion.div">
      <Div4 />
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute h-[158.393px] left-[34.27px] top-[-9.21px] w-[451.561px]" data-name="Container">
      <MotionDiv3 />
    </div>
  );
}

function Container9() {
  return <div className="absolute h-[8.961px] left-0 top-[547.62px] w-[520.002px]" data-name="Container" />;
}

function Container4() {
  return (
    <div className="absolute h-[742.64px] left-[19.99px] top-0 w-[520.002px]" data-name="Container">
      <Container5 />
      <Container6 />
      <Container7 />
      <Container8 />
      <Container9 />
    </div>
  );
}

function Crown() {
  return (
    <div className="relative shrink-0 size-[17.998px]" data-name="Crown">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.9981 17.9981">
        <g clipPath="url(#clip0_2005_733)" id="Crown">
          <path d={svgPaths.p30cc1000} id="Vector" stroke="var(--stroke-0, #0A0E1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          <path d="M3.75 15.7485H14.2489" id="Vector_2" stroke="var(--stroke-0, #0A0E1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
        </g>
        <defs>
          <clipPath id="clip0_2005_733">
            <rect fill="white" height="17.9981" width="17.9981" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span3() {
  return (
    <div className="h-[25.496px] relative shrink-0 w-[203.851px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[25.5px] left-[102px] text-[#0a0e1a] text-[17px] text-center top-[0.23px]">Se porter candidat(e)</p>
      </div>
    </div>
  );
}

function MotionButton() {
  return (
    <div className="absolute content-stretch flex gap-[12.493px] h-[60.491px] items-center justify-center left-[19.99px] rounded-[20px] shadow-[0px_6px_24px_0px_rgba(212,168,67,0.4),0px_2px_8px_0px_rgba(0,0,0,0.2)] top-[662.16px] w-[520.002px]" data-name="motion.button" style={{ backgroundImage: "linear-gradient(173.365deg, rgb(212, 168, 67) 0%, rgb(184, 150, 10) 100%)" }}>
      <Crown />
      <Span3 />
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[760.571px] overflow-clip relative shrink-0 w-full" data-name="Container">
      <Container4 />
      <MotionButton />
    </div>
  );
}

function Div1() {
  return (
    <div className="h-[760.571px] relative shrink-0 w-[559.983px]" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Container3 />
      </div>
    </div>
  );
}

function Users() {
  return (
    <div className="relative shrink-0 size-[15.996px]" data-name="Users">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15.9962 15.9962">
        <g clipPath="url(#clip0_2005_725)" id="Users">
          <path d={svgPaths.p8fbfd80} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
          <path d={svgPaths.p1a3a00} id="Vector_2" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
          <path d={svgPaths.pedcd480} id="Vector_3" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
          <path d={svgPaths.p19d0bc00} id="Vector_4" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
        </g>
        <defs>
          <clipPath id="clip0_2005_725">
            <rect fill="white" height="15.9962" width="15.9962" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function H1() {
  return (
    <div className="flex-[1_0_0] h-[26.997px] min-h-px min-w-px relative" data-name="h2">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[27px] left-0 text-[#a07808] text-[18px] top-[-1.38px]">Habitants du village</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="absolute content-stretch flex gap-[9.99px] h-[26.997px] items-center left-[19.99px] top-[19.99px] w-[520.002px]" data-name="Container">
      <Users />
      <H1 />
    </div>
  );
}

function P4() {
  return (
    <div className="absolute h-[17.998px] left-[19.99px] top-[51.98px] w-[520.002px]" data-name="p">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-0 not-italic text-[#7a6a4a] text-[12px] top-[0.85px]">8 vivants · 0 mort</p>
    </div>
  );
}

function Span4() {
  return (
    <div className="absolute bg-[rgba(160,120,8,0.17)] h-[19.981px] left-[52.95px] rounded-[20668800px] top-[5.61px] w-[21.992px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[15px] left-[11.35px] text-[#a07808] text-[10px] text-center top-[2.11px] tracking-[0.24px]">8</p>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[rgba(160,120,8,0.12)] h-[31.203px] relative rounded-[12.5px] shrink-0 w-[88.047px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(160,120,8,0.33)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[18px] left-[29.61px] text-[#a07808] text-[12px] text-center top-[6.22px] tracking-[0.24px]">Tous</p>
        <Span4 />
      </div>
    </div>
  );
}

function Span5() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.06)] h-[19.981px] left-[86.58px] rounded-[20668800px] top-[5.61px] w-[21.992px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[15px] left-[11.15px] text-[#7a6a4a] text-[10px] text-center top-[2.11px] tracking-[0.24px]">7</p>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[rgba(0,0,0,0.03)] h-[31.203px] relative rounded-[12.5px] shrink-0 w-[121.685px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(0,0,0,0.08)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[46.11px] text-[#9a8a6a] text-[12px] text-center top-[6.22px] tracking-[0.24px]">Inconnus</p>
        <Span5 />
      </div>
    </div>
  );
}

function Span6() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.06)] h-[19.981px] left-[70.7px] rounded-[20668800px] top-[5.61px] w-[21.992px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[15px] left-[11.1px] text-[#7a6a4a] text-[10px] text-center top-[2.11px] tracking-[0.24px]">0</p>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[rgba(0,0,0,0.03)] h-[31.203px] relative rounded-[12.5px] shrink-0 w-[105.804px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(0,0,0,0.08)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[38.11px] text-[#9a8a6a] text-[12px] text-center top-[6.22px] tracking-[0.24px]">Village</p>
        <Span6 />
      </div>
    </div>
  );
}

function Span7() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.06)] h-[19.981px] left-[58.93px] rounded-[20668800px] top-[5.61px] w-[21.992px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[15px] left-[11.1px] text-[#7a6a4a] text-[10px] text-center top-[2.11px] tracking-[0.24px]">0</p>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[rgba(0,0,0,0.03)] h-[31.203px] relative rounded-[12.5px] shrink-0 w-[94.033px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(0,0,0,0.08)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[32.11px] text-[#9a8a6a] text-[12px] text-center top-[6.22px] tracking-[0.24px]">Loups</p>
        <Span7 />
      </div>
    </div>
  );
}

function Span8() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.06)] h-[19.981px] left-[85.1px] rounded-[20668800px] top-[5.61px] w-[21.992px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[15px] left-[11.1px] text-[#7a6a4a] text-[10px] text-center top-[2.11px] tracking-[0.24px]">0</p>
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[rgba(0,0,0,0.03)] h-[31.203px] relative rounded-[12.5px] shrink-0 w-[120.203px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(0,0,0,0.08)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[45.11px] text-[#9a8a6a] text-[12px] text-center top-[6.22px] tracking-[0.24px]">Cimetiere</p>
        <Span8 />
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="absolute content-stretch flex gap-[7.498px] h-[31.203px] items-start left-[19.99px] overflow-clip top-[79.97px] w-[520.002px]" data-name="Container">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
      <Button4 />
    </div>
  );
}

function Span9() {
  return (
    <div className="absolute h-[17.998px] left-[34.17px] overflow-clip top-[74.99px] w-[47.921px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[24.5px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 1</p>
    </div>
  );
}

function Span10() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">🧔</p>
      </div>
    </div>
  );
}

function Div7() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span10 />
    </div>
  );
}

function MotionDiv5() {
  return (
    <div className="absolute h-[92.984px] left-[9.99px] top-[9.99px] w-[116.256px]" data-name="motion.div">
      <Span9 />
      <Div7 />
    </div>
  );
}

function Span11() {
  return (
    <div className="absolute h-[17.998px] left-[33.33px] overflow-clip top-[74.99px] w-[49.596px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 2</p>
    </div>
  );
}

function Span12() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👩</p>
      </div>
    </div>
  );
}

function Div8() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span12 />
    </div>
  );
}

function MotionDiv6() {
  return (
    <div className="absolute h-[92.984px] left-[141.24px] top-[9.99px] w-[116.256px]" data-name="motion.div">
      <Span11 />
      <Div8 />
    </div>
  );
}

function Span13() {
  return (
    <div className="absolute h-[17.998px] left-[33.19px] overflow-clip top-[74.99px] w-[49.875px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25.5px] not-italic text-[#a07808] text-[12px] text-center top-[0.85px]">Joueur 3</p>
    </div>
  );
}

function Span14() {
  return (
    <div className="absolute h-[39.991px] left-[18.06px] top-[13.15px] w-[30.183px]" data-name="span">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👨</p>
    </div>
  );
}

function CircleCheck() {
  return (
    <div className="relative shrink-0 size-[7.998px]" data-name="CircleCheck">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.99811 7.99811">
        <g clipPath="url(#clip0_2005_755)" id="CircleCheck">
          <path d={svgPaths.p1f7d0900} id="Vector" stroke="var(--stroke-0, #F0EAD8)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.666509" />
          <path d={svgPaths.p12b46cc8} id="Vector_2" stroke="var(--stroke-0, #F0EAD8)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.666509" />
        </g>
        <defs>
          <clipPath id="clip0_2005_755">
            <rect fill="white" height="7.99811" width="7.99811" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container14() {
  return (
    <div className="absolute bg-[#a07808] content-stretch flex items-center justify-center left-[51.3px] p-[1.848px] rounded-[20668800px] size-[19.99px] top-[51.3px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#ebe4d2] border-[1.848px] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <CircleCheck />
    </div>
  );
}

function Div9() {
  return (
    <div className="absolute bg-[rgba(160,120,8,0.08)] border-[#a07808] border-[1.848px] border-solid left-[23.13px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <Span14 />
      <Container14 />
    </div>
  );
}

function MotionDiv7() {
  return (
    <div className="absolute h-[92.984px] left-[272.49px] top-[9.99px] w-[116.256px]" data-name="motion.div">
      <Span13 />
      <Div9 />
    </div>
  );
}

function Span15() {
  return (
    <div className="absolute h-[17.998px] left-[33.09px] overflow-clip top-[74.99px] w-[50.077px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25.5px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 4</p>
    </div>
  );
}

function Span16() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👵</p>
      </div>
    </div>
  );
}

function Div10() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span16 />
    </div>
  );
}

function MotionDiv8() {
  return (
    <div className="absolute h-[92.984px] left-[403.75px] top-[9.99px] w-[116.256px]" data-name="motion.div">
      <Span15 />
      <Div10 />
    </div>
  );
}

function Span17() {
  return (
    <div className="absolute h-[17.998px] left-[33.24px] overflow-clip top-[74.99px] w-[49.769px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 5</p>
    </div>
  );
}

function Span18() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">🧑</p>
      </div>
    </div>
  );
}

function Div11() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span18 />
    </div>
  );
}

function MotionDiv9() {
  return (
    <div className="absolute h-[92.984px] left-[9.99px] top-[117.97px] w-[116.256px]" data-name="motion.div">
      <Span17 />
      <Div11 />
    </div>
  );
}

function Span19() {
  return (
    <div className="absolute h-[17.998px] left-[33.13px] overflow-clip top-[74.99px] w-[49.991px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 6</p>
    </div>
  );
}

function Span20() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👴</p>
      </div>
    </div>
  );
}

function Div12() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span20 />
    </div>
  );
}

function MotionDiv10() {
  return (
    <div className="absolute h-[92.984px] left-[141.24px] top-[117.97px] w-[116.256px]" data-name="motion.div">
      <Span19 />
      <Div12 />
    </div>
  );
}

function Span21() {
  return (
    <div className="absolute h-[17.998px] left-[33.53px] overflow-clip top-[74.99px] w-[49.182px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 7</p>
    </div>
  );
}

function Span22() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👱‍♀️</p>
      </div>
    </div>
  );
}

function Div13() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span22 />
    </div>
  );
}

function MotionDiv11() {
  return (
    <div className="absolute h-[92.984px] left-[272.49px] top-[117.97px] w-[116.256px]" data-name="motion.div">
      <Span21 />
      <Div13 />
    </div>
  );
}

function Span23() {
  return (
    <div className="absolute h-[17.998px] left-[33.12px] overflow-clip top-[74.99px] w-[50.019px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[18px] left-[25px] not-italic text-[#2a1f10] text-[12px] text-center top-[0.85px]">Joueur 8</p>
    </div>
  );
}

function Span24() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-0 not-italic text-[#2a1f10] text-[30px] top-[-0.15px] tracking-[0.3955px]">👱</p>
      </div>
    </div>
  );
}

function Div14() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.04)] content-stretch flex items-center justify-center left-[23.13px] p-[1.848px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <Span24 />
    </div>
  );
}

function MotionDiv12() {
  return (
    <div className="absolute h-[92.984px] left-[403.75px] top-[117.97px] w-[116.256px]" data-name="motion.div">
      <Span23 />
      <Div14 />
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute h-[210.954px] left-[19.99px] top-[126.17px] w-[520.002px]" data-name="Container">
      <MotionDiv5 />
      <MotionDiv6 />
      <MotionDiv7 />
      <MotionDiv8 />
      <MotionDiv9 />
      <MotionDiv10 />
      <MotionDiv11 />
      <MotionDiv12 />
    </div>
  );
}

function P5() {
  return (
    <div className="h-[16.497px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Inter:Italic',sans-serif] font-normal italic leading-[16.5px] left-[244.88px] text-[#9a8a6a] text-[11px] text-center top-[0.23px] tracking-[0.0645px]">Appuyez sur un joueur pour noter votre hypothese sur son role</p>
    </div>
  );
}

function Container15() {
  return (
    <div className="absolute bg-[rgba(160,120,8,0.08)] content-stretch flex flex-col h-[47.719px] items-start left-[19.99px] pb-[0.616px] pt-[15.611px] px-[15.611px] rounded-[12.5px] top-[362.12px] w-[520.002px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(160,120,8,0.25)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <P5 />
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[439.829px] relative shrink-0 w-full" data-name="Container">
      <Container11 />
      <P4 />
      <Container12 />
      <Container13 />
      <Container15 />
    </div>
  );
}

function Div6() {
  return (
    <div className="h-[760.571px] relative shrink-0 w-[559.983px]" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Container10 />
      </div>
    </div>
  );
}

function Scroll() {
  return (
    <div className="relative shrink-0 size-[27.998px]" data-name="Scroll">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27.9982 27.9982">
        <g id="Scroll">
          <path d={svgPaths.p2321bf00} id="Vector" stroke="var(--stroke-0, #8A7E65)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.33318" />
          <path d={svgPaths.p5dc4080} id="Vector_2" stroke="var(--stroke-0, #8A7E65)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.33318" />
        </g>
      </svg>
    </div>
  );
}

function Container17() {
  return (
    <div className="bg-[rgba(212,168,67,0.08)] relative rounded-[20668800px] shrink-0 size-[79.991px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(212,168,67,0.15)] border-solid inset-0 pointer-events-none rounded-[20668800px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[0.616px] relative size-full">
        <Scroll />
      </div>
    </div>
  );
}

function P6() {
  return (
    <div className="h-[25.496px] relative shrink-0 w-[241.483px]" data-name="p">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel_Decorative:Regular',sans-serif] leading-[25.5px] left-0 not-italic text-[#4a3f30] text-[17px] top-[0.23px]">Aucune quete disponible</p>
      </div>
    </div>
  );
}

function P7() {
  return (
    <div className="h-[42.002px] relative shrink-0 w-[319.992px]" data-name="p">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[21px] left-[160.28px] not-italic text-[#8a7e65] text-[14px] text-center top-[-0.15px] tracking-[-0.1504px] w-[269px] whitespace-pre-wrap">{`Le Maitre du Jeu n'a pas encore revele de missions pour vous. Restez a l'ecoute !`}</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex flex-col gap-[14.995px] h-[297.46px] items-center justify-center relative shrink-0 w-full" data-name="Container">
      <Container17 />
      <P6 />
      <P7 />
    </div>
  );
}

function Div15() {
  return (
    <div className="h-[760.571px] relative shrink-0 w-[559.983px]" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Container16 />
      </div>
    </div>
  );
}

function MotionDiv() {
  return (
    <div className="content-stretch flex h-[760.571px] items-start relative shrink-0 w-full" data-name="motion.div">
      <Div1 />
      <Div6 />
      <Div15 />
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex flex-col h-[760.571px] items-start left-0 overflow-clip pr-[-1119.956px] top-[59.21px] w-[559.993px]" data-name="Container">
      <MotionDiv />
    </div>
  );
}

function Span25() {
  return (
    <div className="absolute h-[16.497px] left-[0.23px] top-[22.99px] w-[17.527px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.5px] left-[9px] text-[#a07808] text-[11px] text-center top-[-0.38px]">Jeu</p>
    </div>
  );
}

function Swords() {
  return (
    <div className="h-[17.998px] overflow-clip relative shrink-0 w-full" data-name="Swords">
      <div className="absolute inset-[12.5%_27.08%_27.08%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-6.9%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12.3737 12.3737">
            <path d={svgPaths.p2ea44280} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[54.17%_20.84%_20.83%_54.16%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.99938 5.99938">
            <path d={svgPaths.p34b9af00} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[66.67%_16.67%_16.67%_66.66%]" data-name="Vector">
        <div className="absolute inset-[-25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 4.49954 4.49954">
            <path d={svgPaths.p10400000} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[79.17%_12.5%_12.5%_79.16%]" data-name="Vector">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99969 2.99969">
            <path d={svgPaths.p1ac21e80} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_12.5%_60.42%_60.41%]" data-name="Vector">
        <div className="absolute inset-[-15.38%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6.37434 6.37434">
            <path d={svgPaths.p33c7e180} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/4 left-[20.84%] right-[62.5%] top-[58.33%]" data-name="Vector">
        <div className="absolute inset-[-25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 4.49954 4.49954">
            <path d={svgPaths.p10400000} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[70.83%_70.83%_16.67%_16.67%]" data-name="Vector">
        <div className="absolute inset-[-33.33%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.74961 3.74961">
            <path d={svgPaths.p2d014700} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[79.17%_79.17%_12.5%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99969 2.99969">
            <path d={svgPaths.p2b83f00} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Span26() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 size-[17.998px] top-0" data-name="span">
      <Swords />
    </div>
  );
}

function MotionDiv13() {
  return (
    <div className="absolute h-[39.49px] left-[84.33px] top-[12.49px] w-[17.998px]" data-name="motion.div">
      <Span25 />
      <Span26 />
    </div>
  );
}

function MotionDiv14() {
  return <div className="absolute bg-[#a07808] h-[2.493px] left-[15px] rounded-[20668800px] top-0 w-[156.671px]" data-name="motion.div" />;
}

function Button5() {
  return (
    <div className="absolute h-[64.476px] left-0 top-0 w-[186.661px]" data-name="button">
      <MotionDiv13 />
      <MotionDiv14 />
    </div>
  );
}

function Span27() {
  return (
    <div className="absolute h-[16.497px] left-0 top-[22.99px] w-[44.37px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.5px] left-[22.5px] text-[#9a8a6a] text-[11px] text-center top-[-0.38px]">Village</p>
    </div>
  );
}

function Users1() {
  return (
    <div className="h-[17.998px] overflow-clip relative shrink-0 w-full" data-name="Users">
      <div className="absolute inset-[62.5%_33.33%_12.5%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-16.67%_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9988 5.99938">
            <path d={svgPaths.p3423b4c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_45.83%_54.17%_20.84%]" data-name="Vector">
        <div className="absolute inset-[-12.5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.49923 7.49923">
            <path d={svgPaths.p7379600} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[63.04%_8.34%_12.5%_79.16%]" data-name="Vector">
        <div className="absolute inset-[-17.04%_-33.33%_-17.04%_-33.34%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.7498 5.90207">
            <path d={svgPaths.p19b1c5c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[13.04%_20.8%_54.67%_66.66%]" data-name="Vector">
        <div className="absolute inset-[-12.91%_-33.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.75568 7.31211">
            <path d={svgPaths.p379984c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Span28() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[13.19px] size-[17.998px] top-0" data-name="span">
      <Users1 />
    </div>
  );
}

function MotionDiv15() {
  return (
    <div className="h-[39.49px] relative shrink-0 w-[44.37px]" data-name="motion.div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Span27 />
        <Span28 />
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="absolute content-stretch flex flex-col h-[64.476px] items-center left-[186.66px] py-[12.493px] top-0 w-[186.661px]" data-name="button">
      <MotionDiv15 />
    </div>
  );
}

function Span29() {
  return (
    <div className="absolute h-[16.497px] left-0 top-[22.99px] w-[40.963px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.5px] left-[20.5px] text-[#9a8a6a] text-[11px] text-center top-[-0.38px]">Quêtes</p>
    </div>
  );
}

function Map() {
  return (
    <div className="h-[17.998px] overflow-clip relative shrink-0 w-full" data-name="Map">
      <div className="absolute inset-[13.48%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-5.7%_-5.56%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14.9985 14.6451">
            <path d={svgPaths.p2072f580} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[24.02%_37.5%_13.48%_62.5%]" data-name="Vector">
        <div className="absolute inset-[-6.67%_-0.75px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.49985 12.7487">
            <path d="M0.749923 0.749923V11.9988" id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[13.48%_62.5%_24.02%_37.5%]" data-name="Vector">
        <div className="absolute inset-[-6.67%_-0.75px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.49985 12.7487">
            <path d="M0.749923 0.749923V11.9988" id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Span30() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[11.48px] size-[17.998px] top-0" data-name="span">
      <Map />
    </div>
  );
}

function MotionDiv16() {
  return (
    <div className="h-[39.49px] relative shrink-0 w-[40.963px]" data-name="motion.div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Span29 />
        <Span30 />
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="absolute content-stretch flex flex-col h-[64.476px] items-center left-[373.32px] py-[12.493px] top-0 w-[186.661px]" data-name="button">
      <MotionDiv16 />
    </div>
  );
}

function Container18() {
  return (
    <div className="absolute bg-[rgba(20,18,15,0.82)] border-[rgba(255,255,255,0.08)] border-solid border-t-[0.616px] h-[77.084px] left-0 top-[819.78px] w-[559.993px]" data-name="Container">
      <Button5 />
      <Button6 />
      <Button7 />
    </div>
  );
}

function ArrowLeft() {
  return (
    <div className="absolute left-[10.61px] size-[11.992px] top-[8.61px]" data-name="ArrowLeft">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9923 11.9923">
        <g id="ArrowLeft">
          <path d={svgPaths.pfe58700} id="Vector" stroke="var(--stroke-0, #D4A843)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d="M9.49358 5.99609H2.49805" id="Vector_2" stroke="var(--stroke-0, #D4A843)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
        </g>
      </svg>
    </div>
  );
}

function MotionButton1() {
  return (
    <div className="bg-[rgba(212,168,67,0.15)] h-[29.221px] relative rounded-[12.5px] shrink-0 w-[59.192px]" data-name="motion.button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(212,168,67,0.4)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <ArrowLeft />
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[38.09px] text-[#d4a843] text-[12px] text-center top-[5.23px]">GM</p>
      </div>
    </div>
  );
}

function PhaseIcon() {
  return (
    <div className="relative shrink-0 size-[12.993px]" data-name="PhaseIcon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12.9933 12.9933">
        <g clipPath="url(#clip0_2005_696)" id="PhaseIcon">
          <path d={svgPaths.p29832380} id="Vector" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d="M6.49609 1.08301V2.16578" id="Vector_2" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d="M6.49609 10.8276V11.9104" id="Vector_3" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d={svgPaths.p38eab920} id="Vector_4" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d={svgPaths.p2b2de00} id="Vector_5" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d="M1.08203 6.49658H2.16481" id="Vector_6" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d="M10.8281 6.49658H11.9109" id="Vector_7" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d={svgPaths.p1d5a7a80} id="Vector_8" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
          <path d={svgPaths.p115c1780} id="Vector_9" stroke="var(--stroke-0, #D4A030)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.08278" />
        </g>
        <defs>
          <clipPath id="clip0_2005_696">
            <rect fill="white" height="12.9933" width="12.9933" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span31() {
  return (
    <div className="h-[21.001px] relative shrink-0 w-[44.033px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[21px] left-0 text-[#d4a030] text-[14px] top-[0.23px]">Jour 1</p>
      </div>
    </div>
  );
}

function Span32() {
  return <div className="bg-[rgba(255,255,255,0.18)] h-[11.992px] shrink-0 w-[0.991px]" data-name="span" />;
}

function Users2() {
  return (
    <div className="relative shrink-0 size-[11.992px]" data-name="Users">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9923 11.9923">
        <g clipPath="url(#clip0_2005_745)" id="Users">
          <path d={svgPaths.p2906d080} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" strokeWidth="0.999362" />
          <path d={svgPaths.p34fd3e00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" strokeWidth="0.999362" />
          <path d={svgPaths.p2af3ed40} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" strokeWidth="0.999362" />
          <path d={svgPaths.p2868ef00} id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" strokeWidth="0.999362" />
        </g>
        <defs>
          <clipPath id="clip0_2005_745">
            <rect fill="white" height="11.9923" width="11.9923" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span33() {
  return (
    <div className="h-[19.5px] relative shrink-0 w-[20.953px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[19.5px] left-0 not-italic text-[13px] text-[rgba(255,255,255,0.75)] top-[0.85px] tracking-[-0.0762px]">8/8</p>
      </div>
    </div>
  );
}

function Container21() {
  return (
    <div className="bg-[rgba(0,0,0,0.35)] flex-[1_0_0] h-[37.228px] min-h-px min-w-px relative rounded-[20668800px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(255,255,255,0.12)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.3)]" />
      <div className="flex flex-row items-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12.493px] items-center pl-[18.114px] pr-[0.616px] py-[0.616px] relative size-full">
          <PhaseIcon />
          <Span31 />
          <Span32 />
          <Users2 />
          <Span33 />
        </div>
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="h-[37.228px] relative shrink-0 w-[246.344px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[9.99px] items-center relative size-full">
        <MotionButton1 />
        <Container21 />
      </div>
    </div>
  );
}

function ScrollText() {
  return (
    <div className="relative shrink-0 size-[11.992px]" data-name="ScrollText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9923 11.9923">
        <g clipPath="url(#clip0_2005_690)" id="ScrollText">
          <path d="M7.4945 5.99609H4.99609" id="Vector" stroke="var(--stroke-0, #F0D78C)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d="M7.4945 3.99756H4.99609" id="Vector_2" stroke="var(--stroke-0, #F0D78C)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d={svgPaths.pc6a9700} id="Vector_3" stroke="var(--stroke-0, #F0D78C)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d={svgPaths.p14452a20} id="Vector_4" stroke="var(--stroke-0, #F0D78C)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
        </g>
        <defs>
          <clipPath id="clip0_2005_690">
            <rect fill="white" height="11.9923" width="11.9923" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span34() {
  return (
    <div className="h-[16.497px] relative shrink-0 w-[49.211px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[16.5px] left-[25px] text-[#f0d78c] text-[11px] text-center top-[-0.38px]">Journal</p>
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="bg-[rgba(0,0,0,0.3)] h-[32.724px] relative rounded-[20668800px] shrink-0 w-[99.923px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(255,255,255,0.12)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.3)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[7.498px] items-center pl-[15.611px] pr-[0.616px] py-[0.616px] relative size-full">
        <ScrollText />
        <Span34 />
      </div>
    </div>
  );
}

function Eye() {
  return (
    <div className="relative shrink-0 size-[11.992px]" data-name="Eye">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9923 11.9923">
        <g clipPath="url(#clip0_2005_686)" id="Eye">
          <path d={svgPaths.p31fef000} id="Vector" stroke="var(--stroke-0, #A78BFA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d={svgPaths.pcfdeaf0} id="Vector_2" stroke="var(--stroke-0, #A78BFA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
        </g>
        <defs>
          <clipPath id="clip0_2005_686">
            <rect fill="white" height="11.9923" width="11.9923" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span35() {
  return (
    <div className="h-[17.998px] relative shrink-0 w-[53.571px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[18px] left-[27.5px] text-[#a78bfa] text-[12px] text-center top-[-0.38px]">Joueur 3</p>
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <div className="relative shrink-0 size-[9.99px]" data-name="ChevronDown">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9.99042 9.99042">
        <g id="ChevronDown" opacity="0.6">
          <path d={svgPaths.p190e1000} id="Vector" stroke="var(--stroke-0, #A78BFA)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.832535" />
        </g>
      </svg>
    </div>
  );
}

function Button9() {
  return (
    <div className="bg-[rgba(139,92,246,0.1)] h-[29.221px] relative rounded-[12.5px] shrink-0 w-[111.762px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(139,92,246,0.3)] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[7.498px] items-center pl-[10.606px] pr-[0.616px] py-[0.616px] relative size-full">
        <Eye />
        <Span35 />
        <ChevronDown />
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="h-[32.724px] relative shrink-0 w-[221.676px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[9.99px] items-center relative size-full">
        <Button8 />
        <Button9 />
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="absolute content-stretch flex h-[37.228px] items-center justify-between left-[19.99px] top-[11.99px] w-[520.012px]" data-name="Container">
      <Container20 />
      <Container22 />
    </div>
  );
}

function Div() {
  return (
    <div className="absolute bg-[#1a1a1a] h-[896.866px] left-[-0.26px] overflow-clip top-0 w-[559.993px]" data-name="div">
      <Container />
      <Container2 />
      <Container18 />
      <Container19 />
    </div>
  );
}

export default function LoupsGarous() {
  return (
    <div className="bg-[#f0ead8] relative size-full" data-name="Loups-garous">
      <Section />
      <Div />
    </div>
  );
}