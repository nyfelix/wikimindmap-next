import { DENSITY } from "../hooks/mapParams.ts";
import { DirectionIcon } from "../map/DirectionGlyph.tsx";
import panel from "./Panel.module.css";
import styles from "./MapControls.module.css";

interface Props {
  density: number;
  onDensity: (value: number) => void;
  showHousekeeping: boolean;
  onHousekeeping: (value: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

/** Bottom right: density, See also, the direction legend and zoom (US-03, US-19). */
export function MapControls(props: Props) {
  return (
    <div className={`${panel.panel} ${panel.bottomRight}`} role="group" aria-label="Map controls">
      <label className={styles.label}>
        Links
        <input
          type="range"
          min={DENSITY.min}
          max={DENSITY.max}
          value={props.density}
          onChange={(e) => props.onDensity(Number(e.target.value))}
          aria-label="Links per chapter"
        />
        <output className={styles.output}>{props.density}</output>
      </label>
      <label className={styles.label}>
        <input
          type="checkbox"
          checked={props.showHousekeeping}
          onChange={(e) => props.onHousekeeping(e.target.checked)}
        />
        See also
      </label>
      <div className={styles.legend} aria-label="Link direction symbols">
        <span>
          <DirectionIcon direction="out" />
          out
        </span>
        <span>
          <DirectionIcon direction="both" />
          both ways
        </span>
      </div>
      <div className={styles.zoom}>
        <button type="button" onClick={props.onZoomIn} aria-label="Zoom in" title="Zoom in (+)">
          +
        </button>
        <button type="button" onClick={props.onZoomOut} aria-label="Zoom out" title="Zoom out (−)">
          −
        </button>
        <button type="button" onClick={props.onFit} aria-label="Fit map to window" title="Fit (0)">
          ⤢
        </button>
      </div>
    </div>
  );
}
