export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface Point { x: number; y: number }

export interface SpatialNavigationOptions {
  root?: Document;
  window?: Window;
  selector?: string;
  focusClass?: string;
  focusEvent?: string;
  perpendicularPenalty?: number;
  bridgeName?: string;
  onBack?: () => boolean;
}

export declare const DIRECTIONS: Readonly<Record<Direction, Direction>>;
export declare const KEY_TO_ACTION: Readonly<Record<string, Direction | "SELECT" | "BACK">>;
export declare function centreOf(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): Point;
export declare function scoreCandidate(from: Point, to: Point, direction: Direction, perpendicularPenalty?: number): number | null;

export declare class SpatialNavigator {
  constructor(options?: SpatialNavigationOptions);
  current: Element | null;
  enabled: boolean;
  candidates(): Element[];
  setFocus(element: Element): Element | null;
  focusFirst(): Element | null;
  move(direction: Direction): Element | null;
  select(): Element | null;
  back(): boolean;
  dispatch(action: Direction | "SELECT" | "BACK"): boolean;
}

export declare function installSpatialNavigation(options?: SpatialNavigationOptions): SpatialNavigator;
