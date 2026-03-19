import svgPaths from "./svg-erxhdfo0ub";
import imgMotionDiv from "figma:asset/a82839620a1569fcbf0c2b77dd03b73637aa89ad.png";

function Section() {
  return <div className="h-0 shrink-0 w-full" data-name="Section" />;
}

function Div2() {
  return <div className="h-[852.515px] shrink-0 w-full" data-name="div" style={{ backgroundImage: "linear-gradient(0deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.12) 40%, rgba(0, 0, 0, 0) 60%), linear-gradient(rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 20%)" }} />;
}

function MotionDiv1() {
  return (
    <div className="absolute content-stretch flex flex-col h-[852.515px] items-start left-0 top-0 w-[392.995px]" data-name="motion.div">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img alt="" className="absolute h-full left-[-144.34%] max-w-none top-0 w-[388.69%]" src={imgMotionDiv} />
      </div>
      <Div2 />
    </div>
  );
}

function MotionDiv2() {
  return <div className="absolute bg-gradient-to-t from-[rgba(0,0,0,0.72)] h-[775px] left-0 to-[rgba(0,0,0,0)] top-0 via-[55%] via-[rgba(0,0,0,0.5)] w-[393px]" data-name="motion.div" />;
}

function P() {
  return (
    <div className="h-[61.194px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Black',sans-serif] font-black leading-[61.2px] left-[159.26px] text-[72px] text-center text-white top-[0.14px]">04:49</p>
    </div>
  );
}

function P1() {
  return (
    <div className="h-[22.791px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[22.8px] left-[159px] text-[15.2px] text-[rgba(255,255,255,0.9)] text-center top-[0.23px] tracking-[1.52px]">Votez qui eliminer</p>
    </div>
  );
}

function P2() {
  return (
    <div className="h-[19.201px] relative shrink-0 w-full" data-name="p">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[19.2px] left-[159.64px] text-[12.8px] text-[rgba(255,255,255,0.6)] text-center top-[-0.38px]">1 / 60 votes</p>
    </div>
  );
}

function Div3() {
  return (
    <div className="content-stretch flex flex-col gap-[6.391px] h-[48.383px] items-start relative shrink-0 w-full" data-name="div">
      <P1 />
      <P2 />
    </div>
  );
}

function MotionDiv3() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[11.992px] h-[121.569px] items-start left-[37.34px] top-[165px] w-[318.317px]" data-name="motion.div">
      <P />
      <Div3 />
    </div>
  );
}

function Vote() {
  return (
    <div className="absolute left-[123.5px] size-[15.996px] top-[20.49px]" data-name="Vote">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15.9962 15.9962">
        <g clipPath="url(#clip0_523_3276)" id="Vote">
          <path d={svgPaths.p2da49600} id="Vector" stroke="var(--stroke-0, #D4A843)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
          <path d={svgPaths.p3f709a00} id="Vector_2" stroke="var(--stroke-0, #D4A843)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
          <path d="M14.6632 12.6637H1.33302" id="Vector_3" stroke="var(--stroke-0, #D4A843)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33302" />
        </g>
        <defs>
          <clipPath id="clip0_523_3276">
            <rect fill="white" height="15.9962" width="15.9962" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function MotionButton() {
  return (
    <div className="absolute bg-[rgba(61,52,36,0.8)] border-[1.62px] border-[rgba(212,168,67,0.3)] border-solid h-[60.222px] left-[20px] rounded-[14px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.3)] top-[693px] w-[352.995px]" data-name="motion.button">
      <Vote />
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[24px] left-[187.49px] text-[#d4a843] text-[16px] text-center top-[16.11px]">Nominer</p>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute h-[852.515px] left-0 top-0 w-[392.995px]" data-name="Container">
      <MotionDiv3 />
      <MotionButton />
    </div>
  );
}

function Container2() {
  return <div className="absolute left-[381px] size-0 top-[25.61px]" data-name="Container" />;
}

function Span() {
  return (
    <div className="h-[26.4px] relative shrink-0 w-[17.863px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Recoleta:Regular',sans-serif] leading-[26.4px] left-0 not-italic text-[#2a1f10] text-[17.6px] top-[-0.54px] tracking-[-0.4366px]">☀️</p>
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="h-[20.395px] relative shrink-0 w-[53.205px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[20.4px] left-0 text-[13.6px] text-white top-[-0.38px] tracking-[1.088px] uppercase">Jour 1</p>
      </div>
    </div>
  );
}

function Span2() {
  return (
    <div className="h-[15.602px] relative shrink-0 w-[47.594px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[15.6px] left-0 text-[10.4px] text-[rgba(255,255,255,0.7)] top-[-0.38px]">60 en vie</p>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.5)] content-stretch flex gap-[7.998px] h-[39.625px] items-center left-[116.56px] pl-[12.608px] pr-[0.616px] py-[0.616px] rounded-[14px] top-[8px] w-[159.876px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(255,255,255,0.15)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Span />
      <Span1 />
      <Span2 />
    </div>
  );
}

function ScrollText() {
  return (
    <div className="absolute left-[8.38px] size-[20px] top-[9.38px]" data-name="ScrollText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="ScrollText">
          <path d="M12.5 10H8.33333" id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d="M12.5 6.66667H8.33333" id="Vector_2" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d={svgPaths.p3d225c00} id="Vector_3" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d={svgPaths.p1cb6c600} id="Vector_4" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
        </g>
      </svg>
    </div>
  );
}

function Span3() {
  return <div className="absolute h-[16.497px] left-[31.98px] top-[11.14px] w-[48.874px]" data-name="span" />;
}

function Button() {
  return (
    <div className="absolute border-[0.616px] border-[rgba(160,120,8,0.25)] border-solid h-[40px] left-[338px] rounded-[14px] top-[8px] w-[38px]" data-name="button" style={{ backgroundImage: "linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.5) 100%), linear-gradient(90deg, rgba(160, 120, 8, 0.08) 0%, rgba(160, 120, 8, 0.08) 100%)" }}>
      <ScrollText />
      <Span3 />
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute h-[51.223px] left-0 top-[18px] w-[392.995px]" data-name="Container">
      <Container2 />
      <Container3 />
      <Button />
    </div>
  );
}

function Span4() {
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
      <div className="absolute inset-[54.17%_20.83%_20.83%_54.17%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.99938 5.99938">
            <path d={svgPaths.p34b9af00} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[66.67%_16.67%_16.67%_66.67%]" data-name="Vector">
        <div className="absolute inset-[-25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 4.49954 4.49954">
            <path d={svgPaths.p10400000} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[79.17%_12.5%_12.5%_79.17%]" data-name="Vector">
        <div className="absolute inset-[-50%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.99969 2.99969">
            <path d={svgPaths.p1ac21e80} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_12.5%_60.42%_60.42%]" data-name="Vector">
        <div className="absolute inset-[-15.38%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6.37434 6.37434">
            <path d={svgPaths.p33c7e180} id="Vector" stroke="var(--stroke-0, #A07808)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/4 left-[20.83%] right-[62.5%] top-[58.33%]" data-name="Vector">
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

function Span5() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 size-[17.998px] top-0" data-name="span">
      <Swords />
    </div>
  );
}

function MotionDiv4() {
  return (
    <div className="absolute h-[39.49px] left-[56.5px] top-[12.49px] w-[17.998px]" data-name="motion.div">
      <Span4 />
      <Span5 />
    </div>
  );
}

function MotionDiv5() {
  return <div className="absolute bg-[#a07808] h-[2.493px] left-[15px] rounded-[20668800px] top-0 w-[101.011px]" data-name="motion.div" />;
}

function Button1() {
  return (
    <div className="absolute h-[64.476px] left-0 top-0 w-[131.001px]" data-name="button">
      <MotionDiv4 />
      <MotionDiv5 />
    </div>
  );
}

function Span6() {
  return (
    <div className="absolute h-[16.497px] left-0 top-[22.99px] w-[44.37px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.5px] left-[22.5px] text-[#9a8a6a] text-[11px] text-center top-[-0.38px]">Village</p>
    </div>
  );
}

function Users() {
  return (
    <div className="h-[17.998px] overflow-clip relative shrink-0 w-full" data-name="Users">
      <div className="absolute inset-[62.5%_33.33%_12.5%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-16.67%_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9988 5.99938">
            <path d={svgPaths.p3423b4c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_45.83%_54.17%_20.83%]" data-name="Vector">
        <div className="absolute inset-[-12.5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.49923 7.49923">
            <path d={svgPaths.p7379600} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[63.04%_8.33%_12.5%_79.17%]" data-name="Vector">
        <div className="absolute inset-[-17.04%_-33.33%_-17.04%_-33.34%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.7498 5.90207">
            <path d={svgPaths.p19b1c5c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[13.04%_20.8%_54.67%_66.67%]" data-name="Vector">
        <div className="absolute inset-[-12.91%_-33.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.75568 7.31211">
            <path d={svgPaths.p379984c0} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Span7() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[13.19px] size-[17.998px] top-0" data-name="span">
      <Users />
    </div>
  );
}

function MotionDiv6() {
  return (
    <div className="h-[39.49px] relative shrink-0 w-[44.37px]" data-name="motion.div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Span6 />
        <Span7 />
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute content-stretch flex flex-col h-[64.476px] items-center left-[131px] py-[12.493px] top-0 w-[131.001px]" data-name="button">
      <MotionDiv6 />
    </div>
  );
}

function Span8() {
  return (
    <div className="absolute h-[16.497px] left-0 top-[22.99px] w-[40.963px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[16.5px] left-[20.5px] text-[#9a8a6a] text-[11px] text-center top-[-0.38px]">Quêtes</p>
    </div>
  );
}

function Map() {
  return (
    <div className="absolute left-0 size-[17.998px] top-0" data-name="Map">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.9981 17.9981">
        <g id="Map">
          <path d={svgPaths.p32048600} id="Vector" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          <path d="M11.2488 4.32256V15.5714" id="Vector_2" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
          <path d="M6.74931 2.42675V13.6756" id="Vector_3" stroke="var(--stroke-0, #9A8A6A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49985" />
        </g>
      </svg>
    </div>
  );
}

function Text() {
  return (
    <div className="absolute content-stretch flex items-center justify-center left-[15.5px] px-[4px] rounded-[20668800px] shadow-[0px_1px_4px_0px_rgba(229,62,62,0.5)] size-[14.995px] top-[-7.5px]" data-name="Text" style={{ backgroundImage: "linear-gradient(135deg, rgb(229, 62, 62) 0%, rgb(197, 48, 48) 100%)" }}>
      <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-[10px] not-italic relative shrink-0 text-[10px] text-center text-white tracking-[0.1172px]">1</p>
    </div>
  );
}

function Span9() {
  return (
    <div className="absolute left-[11.48px] size-[17.998px] top-0" data-name="span">
      <Map />
      <Text />
    </div>
  );
}

function MotionDiv7() {
  return (
    <div className="h-[39.49px] relative shrink-0 w-[40.963px]" data-name="motion.div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Span8 />
        <Span9 />
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="absolute content-stretch flex flex-col h-[64.476px] items-center left-[262px] py-[12.493px] top-0 w-[131.001px]" data-name="button">
      <MotionDiv7 />
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute bg-[rgba(245,240,228,0.95)] border-[rgba(180,140,50,0.2)] border-solid border-t-[0.616px] h-[77.084px] left-0 top-[775.43px] w-[392.995px]" data-name="Container">
      <Button1 />
      <Button2 />
      <Button3 />
    </div>
  );
}

function Span10() {
  return (
    <div className="absolute h-[13px] left-[18px] overflow-clip top-[74.8px] w-[35px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[12px] left-[17px] not-italic text-[#ff8a95] text-[9.6px] text-center top-[0.85px] tracking-[0.1388px]">Micha</p>
    </div>
  );
}

function Span11() {
  return (
    <div className="absolute h-[16.497px] left-[17.79px] top-[87.8px] w-[35.178px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[16.5px] left-[18px] text-[#d4a843] text-[11px] text-center top-[-0.38px]">1 vote</p>
    </div>
  );
}

function Span12() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[40px] left-[15px] not-italic text-[#2a1f10] text-[30px] text-center top-[-0.15px] tracking-[0.3955px]">👩‍🦳</p>
      </div>
    </div>
  );
}

function MotionDiv8() {
  return (
    <div className="absolute bg-[#c41e3a] left-[45.63px] rounded-[20668800px] size-[23.994px] top-[-0.2px]" data-name="motion.div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.4)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[1.848px] relative size-full">
        <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-[16.8px] not-italic relative shrink-0 text-[11.2px] text-white tracking-[0.0525px]">1</p>
      </div>
    </div>
  );
}

function Div5() {
  return (
    <div className="absolute bg-[rgba(196,30,58,0.2)] content-stretch flex items-center justify-center left-[0.38px] pl-[2.464px] pr-[2.474px] py-[2.464px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[2.464px] border-[rgba(196,30,58,0.6)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_0px_24px_0px_rgba(196,30,58,0.3)]" />
      <Span12 />
      <MotionDiv8 />
    </div>
  );
}

function MotionButton1() {
  return (
    <div className="absolute h-[137.084px] left-[73px] top-[10.2px] w-[70.751px]" data-name="motion.button">
      <Span10 />
      <Span11 />
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium h-[11px] leading-[10.8px] left-[35px] not-italic text-[9px] text-[rgba(255,255,255,0.7)] text-center top-[104.8px] tracking-[0.167px] w-[52px] whitespace-pre-wrap">Nommé par</p>
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[10.8px] left-[35px] not-italic text-[9px] text-center text-white top-[117.8px] tracking-[0.167px]">Celine W</p>
      <Div5 />
    </div>
  );
}

function Span13() {
  return (
    <div className="absolute h-[13px] left-[18px] overflow-clip top-[74.8px] w-[35px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[12px] left-[17px] not-italic text-[9.6px] text-center text-white top-[0.85px] tracking-[0.1388px]">Micha</p>
    </div>
  );
}

function Span14() {
  return (
    <div className="absolute h-[16.497px] left-[17.79px] top-[87.8px] w-[35.178px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[16.5px] left-[18px] text-[#d4a843] text-[11px] text-center top-[-0.38px]">1 vote</p>
    </div>
  );
}

function Span15() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[40px] left-[15px] not-italic text-[#2a1f10] text-[30px] text-center top-[-0.15px] tracking-[0.3955px]">👩‍🦳</p>
      </div>
    </div>
  );
}

function MotionDiv9() {
  return (
    <div className="absolute bg-[#c41e3a] left-[45.63px] rounded-[20668800px] size-[23.994px] top-[-0.2px]" data-name="motion.div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.4)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[1.848px] relative size-full">
        <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-[16.8px] not-italic relative shrink-0 text-[11.2px] text-white tracking-[0.0525px]">1</p>
      </div>
    </div>
  );
}

function Div6() {
  return (
    <div className="absolute bg-[rgba(79,79,79,0.2)] content-stretch flex items-center justify-center left-[0.38px] pl-[2.464px] pr-[2.474px] py-[2.464px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[2.464px] border-[rgba(255,255,255,0.6)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_0px_24px_0px_rgba(0,0,0,0.3)]" />
      <Span15 />
      <MotionDiv9 />
    </div>
  );
}

function MotionButton2() {
  return (
    <div className="absolute h-[137.084px] left-[165px] top-[10.2px] w-[70.751px]" data-name="motion.button">
      <Span13 />
      <Span14 />
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium h-[11px] leading-[10.8px] left-[35px] not-italic text-[9px] text-[rgba(255,255,255,0.7)] text-center top-[104.8px] tracking-[0.167px] w-[52px] whitespace-pre-wrap">Nommé par</p>
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[10.8px] left-[35px] not-italic text-[9px] text-center text-white top-[117.8px] tracking-[0.167px]">Celine W</p>
      <Div6 />
    </div>
  );
}

function Span16() {
  return (
    <div className="absolute h-[13px] left-[18px] overflow-clip top-[74.8px] w-[35px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[12px] left-[17px] not-italic text-[9.6px] text-center text-white top-[0.85px] tracking-[0.1388px]">Micha</p>
    </div>
  );
}

function Span17() {
  return (
    <div className="absolute h-[16.497px] left-[17.79px] top-[87.8px] w-[35.178px]" data-name="span">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[16.5px] left-[18px] text-[11px] text-center text-white top-[-0.38px]">1 vote</p>
    </div>
  );
}

function Span18() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-[30.183px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[40px] left-[15px] not-italic text-[#2a1f10] text-[30px] text-center top-[-0.15px] tracking-[0.3955px]">👩‍🦳</p>
      </div>
    </div>
  );
}

function MotionDiv10() {
  return (
    <div className="absolute bg-[#c41e3a] left-[45.63px] rounded-[20668800px] size-[23.994px] top-[-0.2px]" data-name="motion.div">
      <div aria-hidden="true" className="absolute border-[1.848px] border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.4)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[1.848px] relative size-full">
        <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-[16.8px] not-italic relative shrink-0 text-[11.2px] text-white tracking-[0.0525px]">1</p>
      </div>
    </div>
  );
}

function Div7() {
  return (
    <div className="absolute bg-[rgba(79,79,79,0.2)] content-stretch flex items-center justify-center left-[0.38px] pl-[2.464px] pr-[2.474px] py-[2.464px] rounded-[20668800px] size-[69.991px] top-0" data-name="div">
      <div aria-hidden="true" className="absolute border-[2.464px] border-[rgba(255,255,255,0.6)] border-solid inset-0 pointer-events-none rounded-[20668800px] shadow-[0px_0px_24px_0px_rgba(0,0,0,0.3)]" />
      <Span18 />
      <MotionDiv10 />
    </div>
  );
}

function MotionButton3() {
  return (
    <div className="absolute h-[137.084px] left-[257px] top-[10.2px] w-[70.751px]" data-name="motion.button">
      <Span16 />
      <Span17 />
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium h-[11px] leading-[10.8px] left-[35px] not-italic text-[9px] text-[rgba(255,255,255,0.7)] text-center top-[104.8px] tracking-[0.167px] w-[52px] whitespace-pre-wrap">Nommé par</p>
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[10.8px] left-[35px] not-italic text-[9px] text-center text-white top-[117.8px] tracking-[0.167px]">Celine W</p>
      <Div7 />
    </div>
  );
}

function Div4() {
  return (
    <div className="absolute h-[147px] left-0 top-[308px] w-[393px]" data-name="div">
      <MotionButton1 />
      <MotionButton2 />
      <MotionButton3 />
    </div>
  );
}

function Div1() {
  return (
    <div className="h-[852.515px] overflow-clip relative shrink-0 w-full" data-name="div">
      <MotionDiv1 />
      <MotionDiv2 />
      <Container />
      <Container1 />
      <Container4 />
      <Div4 />
    </div>
  );
}

function MotionDiv() {
  return (
    <div className="content-stretch flex flex-col h-[852.515px] items-start overflow-clip relative shrink-0 w-full" data-name="motion.div">
      <Div1 />
    </div>
  );
}

function Main() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[392.995px]" data-name="main">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <MotionDiv />
      </div>
    </div>
  );
}

function Div() {
  return (
    <div className="bg-gradient-to-b content-stretch flex flex-col from-[#f5f0e4] h-[852.515px] items-start relative shrink-0 to-[#e3dac6] via-1/2 via-[#ebe4d2] w-full" data-name="div">
      <Main />
    </div>
  );
}

function Img() {
  return <div className="h-[851px] shrink-0 w-[393px]" data-name="img" />;
}

export default function LoupsGarous() {
  return (
    <div className="bg-[#f0ead8] content-stretch flex flex-col items-start relative size-full" data-name="Loups-garous">
      <Section />
      <Div />
      <Img />
    </div>
  );
}