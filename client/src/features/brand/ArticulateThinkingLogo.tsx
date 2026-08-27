import { useEffect, useRef, useState } from "react";

const LOGO_SRC = "/manus-storage/articulate-logo-source_c8ded44e.png";
const NATURAL_SIZE = 1254;
const DOT_RADIUS = 14;
const DOT_COLOR = "#FFFFFF";
const LOOP_MS = 5800;

// Waypoints supplied with the Articulate logo artwork, in its native coordinate space.
const LOOP = [[626,309],[620,319],[607,327],[599,339],[588,351],[579,363],[572,376],[564,388],[558,402],[552,415],[546,428],[540,442],[534,455],[528,468],[522,482],[516,495],[510,508],[504,522],[498,535],[492,548],[486,562],[480,575],[474,589],[469,602],[465,617],[463,632],[460,646],[457,661],[446,671],[437,683],[428,696],[421,709],[415,722],[410,736],[403,749],[398,762],[391,776],[386,789],[380,803],[375,816],[368,829],[358,841],[350,854],[344,867],[335,879],[344,867],[350,854],[358,842],[367,830],[375,818],[379,805],[385,792],[390,778],[396,766],[402,753],[408,739],[414,727],[419,713],[426,701],[434,689],[442,676],[451,665],[463,662],[477,666],[491,669],[506,670],[521,670],[537,670],[551,670],[566,670],[581,670],[597,670],[612,670],[627,669],[642,670],[657,670],[673,670],[688,670],[703,670],[717,670],[732,670],[747,670],[762,669],[776,666],[790,662],[803,666],[812,677],[821,689],[828,701],[835,714],[841,727],[846,740],[852,753],[858,766],[864,779],[870,792],[874,805],[879,818],[887,831],[896,842],[903,855],[909,868],[919,879],[909,867],[903,854],[895,841],[886,830],[879,817],[874,803],[868,789],[863,776],[856,762],[850,749],[845,736],[838,722],[832,709],[825,696],[817,684],[808,672],[797,660],[794,646],[791,631],[788,617],[785,602],[780,588],[774,575],[768,562],[762,548],[757,535],[751,521],[745,508],[739,494],[733,481],[727,468],[721,454],[715,441],[710,428],[704,414],[698,401],[692,387],[687,374],[680,360],[669,349],[658,338],[647,327],[634,319],[626,309]] as const;

const NODES = [
  { x: 627, y: 306, r: 79 },
  { x: 627, y: 669, r: 69 },
  { x: 334, y: 879, r: 76 },
  { x: 919, y: 879, r: 76 },
] as const;

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function radiusFor(x: number, y: number) {
  let radius = DOT_RADIUS;
  for (const node of NODES) {
    const distance = Math.hypot(x - node.x, y - node.y);
    if (distance < node.r) {
      radius = Math.max(radius, DOT_RADIUS + smoothstep(1 - distance / node.r) * (node.r - DOT_RADIUS));
    }
  }
  return radius;
}

const cumulativeDistances = LOOP.reduce<number[]>((distances, point, index) => {
  if (!index) return [0];
  const prior = LOOP[index - 1];
  return [...distances, distances[distances.length - 1] + Math.hypot(point[0] - prior[0], point[1] - prior[1])];
}, []);
const totalLength = cumulativeDistances[cumulativeDistances.length - 1] ?? 1;

function pointAtDistance(distance: number): [number, number] {
  const index = Math.min(cumulativeDistances.findIndex((length, pointIndex) => pointIndex > 0 && length >= distance), LOOP.length - 1);
  const safeIndex = index < 1 ? 1 : index;
  const start = cumulativeDistances[safeIndex - 1];
  const end = cumulativeDistances[safeIndex];
  const progress = end > start ? (distance - start) / (end - start) : 0;
  const from = LOOP[safeIndex - 1];
  const to = LOOP[safeIndex];
  return [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
}

function useTravelingDot(active: boolean) {
  const [position, setPosition] = useState<[number, number]>([LOOP[0][0], LOOP[0][1]]);
  const animationFrame = useRef<number | undefined>(undefined);
  const startedAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      startedAt.current = undefined;
      setPosition([LOOP[0][0], LOOP[0][1]]);
      return;
    }
    const animate = (time: number) => {
      startedAt.current ??= time;
      const elapsed = (time - startedAt.current) % LOOP_MS;
      setPosition(pointAtDistance(elapsed / LOOP_MS * totalLength));
      animationFrame.current = requestAnimationFrame(animate);
    };
    animationFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [active]);

  return position;
}

export function ArticulateThinkingLogo({ isThinking, size = 28 }: { isThinking: boolean; size?: number }) {
  const [x, y] = useTravelingDot(isThinking);
  return (
    <div className="articulate-logo-mark" style={{ width: size, height: size }}>
      <img src={LOGO_SRC} alt="Articulate" draggable={false} />
      {isThinking && (
        <svg viewBox={`0 0 ${NATURAL_SIZE} ${NATURAL_SIZE}`} aria-hidden="true">
          <circle cx={x} cy={y} r={radiusFor(x, y)} fill={DOT_COLOR} />
        </svg>
      )}
    </div>
  );
}
