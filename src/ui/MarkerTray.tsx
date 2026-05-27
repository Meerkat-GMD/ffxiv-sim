export type MarkerAsset = {
  alt: string;
  category: 'combat' | 'waymark';
  label: string;
  src: string;
};

const MARKER_ASSET_BASE = '/assets/xivplan/marker';

const WAYMARKS: MarkerAsset[] = [
  marker('Waymark A', 'A', 'waymark_a.png', 'waymark'),
  marker('Waymark B', 'B', 'waymark_b.png', 'waymark'),
  marker('Waymark C', 'C', 'waymark_c.png', 'waymark'),
  marker('Waymark D', 'D', 'waymark_d.png', 'waymark'),
  marker('Waymark 1', '1', 'waymark_1.png', 'waymark'),
  marker('Waymark 2', '2', 'waymark_2.png', 'waymark'),
  marker('Waymark 3', '3', 'waymark_3.png', 'waymark'),
  marker('Waymark 4', '4', 'waymark_4.png', 'waymark'),
];

const COMBAT_MARKERS: MarkerAsset[] = [
  marker('Attack marker 1', 'Atk', 'attack1.png', 'combat'),
  marker('Bind marker 1', 'Bind', 'bind1.png', 'combat'),
  marker('Ignore marker 1', 'Ignore', 'ignore1.png', 'combat'),
  marker('Red target marker', 'Target', 'target_red.png', 'combat'),
  marker('Shape triangle marker', 'Triangle', 'shape_triangle.png', 'combat'),
  marker('Shape circle marker', 'Circle', 'shape_circle.png', 'combat'),
  marker('Shape square marker', 'Square', 'shape_square.png', 'combat'),
  marker('Shape cross marker', 'Cross', 'shape_cross.png', 'combat'),
];

type MarkerTrayProps = {
  selectedMarker?: MarkerAsset;
  onSelectMarker?: (marker: MarkerAsset) => void;
};

export function MarkerTray({
  selectedMarker,
  onSelectMarker,
}: MarkerTrayProps = {}) {
  return (
    <section className="panel marker-tray" aria-label="Available marker tray">
      <h2>Markers</h2>
      <MarkerGroup
        label="Waymarks"
        markers={WAYMARKS}
        onSelectMarker={onSelectMarker}
        selectedMarker={selectedMarker}
      />
      <MarkerGroup
        label="Combat"
        markers={COMBAT_MARKERS}
        onSelectMarker={onSelectMarker}
        selectedMarker={selectedMarker}
      />
    </section>
  );
}

function MarkerGroup({
  label,
  markers,
  onSelectMarker,
  selectedMarker,
}: {
  label: string;
  markers: MarkerAsset[];
  selectedMarker?: MarkerAsset;
  onSelectMarker?: (marker: MarkerAsset) => void;
}) {
  return (
    <div className="marker-group" aria-label={`${label} markers`}>
      <h3>{label}</h3>
      <ul className="marker-grid">
        {markers.map((markerAsset) => (
          <li className="marker-tile" key={markerAsset.src}>
            <button
              aria-label={`Select ${markerAsset.alt}`}
              aria-pressed={selectedMarker?.src === markerAsset.src}
              className="marker-button"
              data-marker-src={markerAsset.src}
              onClick={() => onSelectMarker?.(markerAsset)}
              type="button"
            >
              <img
                alt={markerAsset.alt}
                className="marker-icon"
                height="32"
                loading="lazy"
                src={markerAsset.src}
                width="32"
              />
              <span>{markerAsset.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function marker(
  alt: string,
  label: string,
  filename: string,
  category: MarkerAsset['category'],
): MarkerAsset {
  return {
    alt,
    category,
    label,
    src: `${MARKER_ASSET_BASE}/${filename}`,
  };
}
