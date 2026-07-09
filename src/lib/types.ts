export type RawRow = {
  name: string;
  route: string;
  tourNo: string;
  date: string | null;
  seats: number;
  sold: number;
  sourceSheet?: string;
};

export type TourProduct = {
  id: string;
  name: string;
  route: string;
  departures: number;
  seats: number;
  sold: number;
  ratio: number;
  firstDate: string | null;
  lastDate: string | null;
  rows: RawRow[];
  familyKey: string;
};

export type PerformanceTier = "none" | "low" | "medium" | "good";

export type CannibalPair = {
  a: TourProduct;
  b: TourProduct;
  routeSim: number;
  score: number;
  sharedDates: number;
  nearDates: number;
  minDepartures: number;
  survivor: TourProduct;
  victim: TourProduct;
  salesBasis: boolean;
};

export type Thresholds = {
  lowMax: number;
  mediumMax: number;
  similarityMin: number;
};

export type AnalysisResult = {
  rawRowCount: number;
  products: TourProduct[];
  uniqueIds: number;
  uniqueNameRoutePairs: number;
  inconsistentIds: { id: string; names: string[]; routes: string[] }[];
  tiers: Record<PerformanceTier, TourProduct[]>;
  cannibalPairs: CannibalPair[];
  thresholds: Thresholds;
  totals: { seats: number; sold: number };
};
