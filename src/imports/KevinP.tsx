import imgPlayerAvatar from "figma:asset/68eb6498f6e2d0c2a5ebed75f1b3487fb9cae4ff.png";

export default function KevinP() {
  return (
    <div className="bg-gradient-to-b from-[#070b1a] overflow-clip relative rounded-[9999px] size-full to-[#0f1629]" data-name="Kevin P">
      <div className="absolute flex h-[554.653px] items-center justify-center left-[-11.39px] top-[-27.25px] w-[542.315px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-[3.89deg]">
          <div className="h-[521.421px] relative w-[508.154px]" data-name="player-avatar">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img alt="" className="absolute h-[311.78%] left-[-303.38%] max-w-none top-[-28.89%] w-[426.56%]" src={imgPlayerAvatar} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}