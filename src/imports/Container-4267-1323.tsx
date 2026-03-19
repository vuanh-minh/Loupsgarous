import svgPaths from "./svg-963t44bmr3";

function TextInput() {
  return (
    <div className="absolute content-stretch flex h-[17.989px] items-center left-[33.98px] overflow-clip top-[10px] w-[760.831px]" data-name="Text Input">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[12px] text-[rgba(192,200,216,0.5)] whitespace-nowrap">Rechercher un joueur...</p>
    </div>
  );
}

function Icon() {
  return (
    <div className="h-[13.985px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[12.5%_20.83%_20.83%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-6.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10.4885 10.4885">
            <path d={svgPaths.p27cae100} id="Vector" stroke="var(--stroke-0, #939393)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16539" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[69.58%_12.5%_12.5%_69.58%]" data-name="Vector">
        <div className="absolute inset-[-23.26%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 3.67097 3.67097">
            <path d={svgPaths.p21f88a00} id="Vector" stroke="var(--stroke-0, #939393)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16539" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[11.99px] size-[13.985px] top-[12px]" data-name="Container">
      <Icon />
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[37.998px] overflow-clip relative rounded-[10px] shrink-0 w-[806.798px]" data-name="Container">
      <TextInput />
      <Container2 />
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[37.998px] relative rounded-[10px] shrink-0 w-[806.798px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(120,100,60,0.15)] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-[rgba(255,255,255,0.04)] content-stretch flex items-center px-[12px] py-[8px] relative rounded-[10px] size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[0.616px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <Container1 />
      <Container3 />
    </div>
  );
}