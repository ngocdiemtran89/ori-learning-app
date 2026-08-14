// ============================================================
// Phase P3.5H: ORI TOEIC Shared Visual Asset Registry & Draft Types
// ============================================================

export type ToeicVisualAssetType = 'P1_IMAGE' | 'LISTENING_GRAPHIC';
export type ToeicVisualAssetOwnerType = 'QUESTION' | 'GROUP';
export type ToeicVisualAssetStatus = 'MISSING' | 'AUTO_EXTRACTED' | 'NEEDS_REVIEW' | 'APPROVED';

export interface ToeicVisualAssetDraft {
  assetType: ToeicVisualAssetType;
  ownerType: ToeicVisualAssetOwnerType;
  ownerKey: string; // e.g. "Q1".."Q6" for P1, "P3-Q62-64" for graphics

  sourcePdf: 'listening';
  sourcePage: number;

  cropRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  filename?: string;
  blob?: Blob;
  file?: File;
  previewUrl?: string;

  status: ToeicVisualAssetStatus;
  confidence?: number;
}

export type ToeicVisualAssetRegistry = Map<string, ToeicVisualAssetDraft>;

/**
 * 5 Canonical Listening Graphic Targets for Test 1 (P3 & P4)
 */
export const CANONICAL_LISTENING_GRAPHIC_TARGETS: Array<{
  ownerKey: string; // groupKey
  sourcePage: number;
  startQuestion: number;
  endQuestion: number;
  part: 3 | 4;
}> = [
  { ownerKey: 'P3-Q62-64', sourcePage: 7, startQuestion: 62, endQuestion: 64, part: 3 },
  { ownerKey: 'P3-Q65-67', sourcePage: 8, startQuestion: 65, endQuestion: 67, part: 3 },
  { ownerKey: 'P3-Q68-70', sourcePage: 8, startQuestion: 68, endQuestion: 70, part: 3 },
  { ownerKey: 'P4-Q95-97', sourcePage: 11, startQuestion: 95, endQuestion: 97, part: 4 },
  { ownerKey: 'P4-Q98-100', sourcePage: 11, startQuestion: 98, endQuestion: 100, part: 4 },
];

/**
 * Initialize a default registry with 6 P1 Image targets and 5 Listening Graphic targets
 */
export function createDefaultVisualAssetRegistry(): ToeicVisualAssetRegistry {
  const registry: ToeicVisualAssetRegistry = new Map();

  // Part 1 Image Targets (Q1..Q6)
  for (let q = 1; q <= 6; q++) {
    const key = `Q${q}`;
    registry.set(key, {
      assetType: 'P1_IMAGE',
      ownerType: 'QUESTION',
      ownerKey: key,
      sourcePdf: 'listening',
      sourcePage: Math.ceil(q / 3), // Pages 1-2
      status: 'MISSING',
    });
  }

  // Part 3 & 4 Listening Graphic Targets (5 Groups)
  CANONICAL_LISTENING_GRAPHIC_TARGETS.forEach((target) => {
    registry.set(target.ownerKey, {
      assetType: 'LISTENING_GRAPHIC',
      ownerType: 'GROUP',
      ownerKey: target.ownerKey,
      sourcePdf: 'listening',
      sourcePage: target.sourcePage,
      status: 'MISSING',
    });
  });

  return registry;
}

/**
 * Summary breakdown of visual asset registry
 */
export interface VisualAssetRegistrySummary {
  p1ImagesCount: number; // Max 6
  p1ImagesReady: number;
  graphicsCount: number; // Max 5
  graphicsReady: number;
  totalAssetsCount: number; // 11
  totalAssetsReady: number;
  isAssetsReady: boolean;
  missingKeys: string[];
}

export function summarizeVisualAssetRegistry(registry: ToeicVisualAssetRegistry): VisualAssetRegistrySummary {
  let p1Ready = 0;
  let graphicsReady = 0;
  const missingKeys: string[] = [];

  for (let q = 1; q <= 6; q++) {
    const key = `Q${q}`;
    const asset = registry.get(key);
    if (asset && (asset.blob || asset.previewUrl || asset.status === 'APPROVED' || asset.status === 'AUTO_EXTRACTED')) {
      p1Ready++;
    } else {
      missingKeys.push(key);
    }
  }

  CANONICAL_LISTENING_GRAPHIC_TARGETS.forEach((target) => {
    const asset = registry.get(target.ownerKey);
    if (asset && (asset.blob || asset.previewUrl || asset.status === 'APPROVED' || asset.status === 'AUTO_EXTRACTED')) {
      graphicsReady++;
    } else {
      missingKeys.push(target.ownerKey);
    }
  });

  const totalAssetsCount = 11;
  const totalAssetsReady = p1Ready + graphicsReady;
  const isAssetsReady = p1Ready === 6 && graphicsReady === 5;

  return {
    p1ImagesCount: 6,
    p1ImagesReady: p1Ready,
    graphicsCount: 5,
    graphicsReady,
    totalAssetsCount,
    totalAssetsReady,
    isAssetsReady,
    missingKeys,
  };
}
