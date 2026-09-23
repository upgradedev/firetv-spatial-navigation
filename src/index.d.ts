export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type NavigationAction = Direction | "SELECT" | "BACK";

export interface Point {
  x: number;
  y: number;
}

export interface FocusChangeDetail {
  element: Element;
  previous: Element | null;
  label: string;
}

export interface SpatialNavigationOptions {
  root?: Document | Element;
  window?: Window;
  selector?: string;
  focusClass?: string;
  focusEvent?: string;
  perpendicularPenalty?: number;
  bridgeName?: string | false;
  overwriteBridge?: boolean;
  onBack?: () => boolean;
  onFocusChange?: (detail: FocusChangeDetail) => void;
}

export declare const DIRECTIONS: Readonly<Record<Direction, Direction>>;
export declare const KEY_TO_ACTION: Readonly<Record<string, NavigationAction>>;
export declare const KEY_CODE_TO_ACTION: Readonly<Record<number, NavigationAction>>;

export declare function normaliseAction(action: unknown): NavigationAction | null;
export declare function actionFromKeyboardEvent(event: Pick<KeyboardEvent, "key" | "keyCode" | "which"> | null): NavigationAction | null;
export declare function centreOf(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): Point;
export declare function scoreCandidate(from: Point, to: Point, direction: Direction | string, perpendicularPenalty?: number): number | null;
export declare function isNavigable(element: Element | null | undefined, window?: Window): boolean;

export declare class SpatialNavigator {
  constructor(options?: SpatialNavigationOptions);
  root: Document | Element;
  window: Window;
  selector: string;
  focusClass: string;
  focusEvent: string;
  perpendicularPenalty: number;
  current: Element | null;
  enabled: boolean;
  candidates(): Element[];
  setFocus(element: Element | null | undefined): Element | null;
  focusFirst(): Element | null;
  move(direction: Direction | string): Element | null;
  select(): Element | null;
  back(): boolean;
  dispatch(action: NavigationAction | string | number): boolean;
  destroy(): void;
}

export declare function installSpatialNavigation(options?: SpatialNavigationOptions): SpatialNavigator;
