import imgGeneratedImage17712882679221 from "figma:asset/970b6d36e9ae2b4285a385d4f028ab9db13a07a7.png";

function Text() {
  return (
    <div className="h-[39.991px] relative shrink-0 w-full" data-name="Text">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[40px] left-[77.93px] not-italic text-[#e8e0d4] text-[36px] text-center top-[0.77px] tracking-[0.3691px]">🌙</p>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[26.4px] relative shrink-0 w-full" data-name="Heading 2">
      <p className="-translate-x-1/2 absolute font-['Cinzel:Regular',sans-serif] font-normal leading-[26.4px] left-[78px] text-[#7c8db5] text-[17.6px] text-center top-[-1.38px]">Le village dort...</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[13.195px] opacity-54 relative shrink-0 w-full" data-name="Paragraph">
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[13.2px] left-[78.22px] not-italic text-[#7c8db5] text-[8.8px] text-center top-[0.23px] tracking-[0.1759px]">👆 Touchez pour retourner la carte</p>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.994px] h-[91.579px] items-start left-[129.58px] top-[322.95px] w-[155.602px]" data-name="Container">
      <Text />
      <Heading />
      <Paragraph />
    </div>
  );
}

export default function Container() {
  return (
    <div className="border-[#d4a843] border-[0.616px] border-solid overflow-clip relative rounded-[14px] size-full" data-name="Container" style={{ backgroundImage: "linear-gradient(119.385deg, rgba(7, 7, 7, 0.4) 0%, rgba(15, 17, 26, 0.4) 100%)" }}>
      <div className="absolute h-[739px] left-[-501.94px] top-[-0.64px] w-[1324px]" data-name="generated-image-1771288267922. 1">
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 overflow-hidden">
            <img alt="" className="absolute h-full left-0 max-w-none top-0 w-[100.01%]" src={imgGeneratedImage17712882679221} />
          </div>
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(205.968deg, rgba(12, 13, 21, 0.85) 17.943%, rgb(12, 13, 21) 83.476%)" }} />
        </div>
      </div>
      <Container1 />
    </div>
  );
}