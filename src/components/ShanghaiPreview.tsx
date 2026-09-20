import { Popover } from "@base-ui/react/popover";

// Simplified from https://geo.datav.aliyun.com/areas_v3/bound/310000.json.
const SHANGHAI_OUTLINE =
  "M53.9 77.7L50.7 76.7L49.3 78.1L47.5 76.0L47.1 78.3L45.2 78.7L44.7 81.1L46.6 90.3L45.8 92.0L43.5 91.4L43.2 93.1L41.7 92.6L41.0 93.7L32.5 92.9L27.8 93.6L25.6 96.5L25.8 97.5L28.8 97.8L29.8 99.1L29.1 102.7L30.7 107.5L33.3 107.7L34.6 105.3L35.7 106.8L38.2 107.1L39.4 111.2L38.4 113.4L39.6 118.8L38.3 120.4L41.3 122.7L40.6 125.1L38.2 127.2L38.3 128.5L40.6 127.1L42.8 129.5L43.0 128.0L43.9 128.3L45.6 125.6L48.5 124.7L50.8 125.5L50.5 127.1L52.3 127.7L51.3 132.3L50.4 132.6L51.0 133.4L55.9 134.2L57.5 133.2L58.0 134.1L58.3 132.9L60.0 132.8L61.4 136.0L65.2 138.7L64.6 141.2L65.5 144.8L73.8 144.6L80.0 138.9L88.7 133.8L101.2 129.3L125.7 129.5L127.6 130.3L129.5 133.6L132.0 132.3L130.5 128.2L134.3 124.0L134.7 119.9L134.0 112.2L131.3 103.4L116.7 86.6L108.3 74.7L96.9 67.0L89.1 64.5L87.7 63.2L88.7 63.2L77.9 55.0L78.0 54.2L72.1 51.4L70.2 52.8L68.4 52.1L67.8 53.7L63.6 55.2L61.7 53.5L61.2 55.2L59.7 55.1L56.5 58.2L53.3 59.0L54.9 60.9L53.2 61.6L54.4 62.8L53.0 64.8L53.4 65.5L49.4 67.9L49.6 69.4L51.7 70.2L51.6 74.8L52.9 74.0L54.6 76.9ZM132.5 39.6L94.5 29.2L86.9 24.4L80.5 22.6L76.0 15.4L68.9 11.0L64.6 12.0L58.4 15.2L50.5 23.7L53.1 24.3L66.9 39.7L74.8 46.8L77.0 43.2L80.7 42.6L97.4 51.9L104.5 53.7L120.1 60.3L127.0 60.0L133.1 56.7L134.1 55.3ZM113.7 74.0L115.6 73.9L115.3 70.0L112.8 64.9L105.9 61.2L95.2 57.8L93.0 54.2L87.9 53.9L93.9 59.9L108.8 69.0ZM115.9 68.7L116.4 72.4L120.8 76.0L136.4 77.1L144.2 80.1L146.6 74.3L146.0 72.7L130.2 70.9L117.4 66.1L115.1 66.1ZM99.2 58.9L99.9 58.0L97.9 55.9L94.3 55.2L96.0 57.4ZM129.4 84.6L131.0 90.9L134.5 90.7L136.0 87.2L135.7 84.0L130.8 82.9ZM123.6 81.7L124.3 84.6L127.1 86.9L127.5 82.5Z";

export default function ShanghaiPreview({ label }: { label: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="shanghai-trigger" openOnHover delay={180} closeDelay={160}>
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="shanghai-positioner"
          side="top"
          sideOffset={10}
          collisionPadding={12}
        >
          <Popover.Popup className="shanghai-preview">
            <div className="shanghai-heading">
              <Popover.Title className="shanghai-title">上海</Popover.Title>
              <span className="shanghai-english" aria-hidden="true">
                SHANGHAI
              </span>
              <Popover.Close className="shanghai-close" aria-label="关闭上海地图">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M4 4L12 12M12 4L4 12" />
                </svg>
              </Popover.Close>
            </div>
            <svg className="shanghai-map" viewBox="0 0 184 156" aria-hidden="true">
              <path
                className="map-grid"
                d="M0 39H184M0 78H184M0 117H184M46 0V156M92 0V156M138 0V156"
              />
              <path className="map-land" d={SHANGHAI_OUTLINE} />
              <path
                className="map-river"
                d="M87 65.8L89.4 72.9L90 77.3L87.7 79.4L86.1 81.6L87.3 83.6L86.1 86.5L83.2 89.3L80.8 91.1L79.3 94.4L78.3 99.3L80 102.4L78.7 105.1L73.6 106.4L67.9 107.6L60.2 106.4"
              />
              <circle className="map-marker-halo" cx="84.4" cy="82.8" r="7" />
              <circle className="map-marker" cx="84.4" cy="82.8" r="3" />
              <path className="map-leader" d="M89 83H102" />
              <text className="map-city" x="106" y="86">
                上海
              </text>
              <text className="map-water-label" x="145" y="132">
                东海
              </text>
              <path className="map-north" d="M15 29V17M12 21L15 17L18 21" />
              <text className="map-north-label" x="15" y="12" textAnchor="middle">
                N
              </text>
            </svg>
            <Popover.Description className="shanghai-caption">
              长江入海处，黄浦江两岸。
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
