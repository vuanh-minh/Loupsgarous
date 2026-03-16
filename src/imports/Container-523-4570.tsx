import svgPaths from "./svg-tq2g83o1mj";

function Span() {
  return (
    <div className="absolute h-[23.994px] left-[26.49px] top-0 w-[67.315px]" data-name="span">
      <p className="absolute font-['Cinzel:Bold',sans-serif] font-bold leading-[24px] left-0 text-[#d4a843] text-[16px] top-[-0.38px] tracking-[0.48px]">Indices</p>
    </div>
  );
}

function Lightbulb() {
  return (
    <div className="flex-[1_0_0] h-[13.994px] min-h-px min-w-px relative shadow-[0px_0px_6px_0px_rgba(212,165,74,0.35)]" data-name="Lightbulb">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <div className="absolute bottom-[41.67%] left-1/4 right-1/4 top-[8.33%]" data-name="Vector">
          <div className="absolute inset-[-8.33%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.16333 8.16344">
              <path d={svgPaths.p235440} id="Vector" stroke="var(--stroke-0, #D4A54A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-1/4 left-[37.5%] right-[37.5%] top-3/4" data-name="Vector">
          <div className="absolute inset-[-0.58px_-16.67%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 4.66476 1.16619">
              <path d="M0.583095 0.583095H4.08167" id="Vector" stroke="var(--stroke-0, #D4A54A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-[91.67%_41.67%_8.33%_41.67%]" data-name="Vector">
          <div className="absolute inset-[-0.58px_-25%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.49857 1.16619">
              <path d="M0.583095 0.583095H2.91548" id="Vector" stroke="var(--stroke-0, #D4A54A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="absolute content-stretch flex items-start left-0 size-[13.994px] top-[5px]" data-name="span">
      <Lightbulb />
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[23.994px] relative shrink-0 w-full" data-name="Container">
      <Span />
      <Span1 />
    </div>
  );
}

function Lightbulb1() {
  return (
    <div className="absolute left-[13.11px] size-[11.992px] top-[15.6px]" data-name="Lightbulb">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.9923 11.9923">
        <g clipPath="url(#clip0_495_1630)" id="Lightbulb">
          <path d={svgPaths.p3fc76500} id="Vector" stroke="var(--stroke-0, #F59E0B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d="M4.49713 8.99426H7.49522" id="Vector_2" stroke="var(--stroke-0, #F59E0B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
          <path d="M4.99681 10.993H6.99554" id="Vector_3" stroke="var(--stroke-0, #F59E0B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.999362" />
        </g>
        <defs>
          <clipPath id="clip0_495_1630">
            <rect fill="white" height="11.9923" width="11.9923" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function P() {
  return (
    <div className="absolute h-[21.001px] left-[35.09px] top-[13.11px] w-[24.726px]" data-name="p">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[21px] left-0 not-italic text-[14px] text-white top-[-0.15px] tracking-[-0.1504px]">test</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="bg-[rgba(255,255,255,0.05)] h-[47.219px] relative rounded-[12.5px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#685844] border-[0.616px] border-solid inset-0 pointer-events-none rounded-[12.5px]" />
      <Lightbulb1 />
      <P />
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-[rgba(0,0,0,0.3)] content-stretch flex flex-col gap-[12.493px] items-start pb-[0.616px] pt-[8.614px] px-[15.611px] relative rounded-[20px] size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(164,136,103,0.45)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[0px_0px_12px_0px_rgba(139,90,43,0.1)]" />
      <Container1 />
      <Container2 />
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(222,195,150,0.08)]" />
    </div>
  );
}