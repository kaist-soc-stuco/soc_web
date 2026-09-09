import { ForbiddenException } from "@nestjs/common";
import type { PostgresTransaction } from "../../infrastructure/postgres/postgres.provider";
import type { AssetRepository } from "../asset/repositories/asset.repository";

const ASSET_REFERENCE_PATTERN = /(?:asset:|\/assets\/)(\d+)(?:\/content)?/g;

export const collectSurveyAssetIds = (...values: unknown[]): string[] => {
  const assetIds = new Set<string>();

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(ASSET_REFERENCE_PATTERN)) {
        if (match[1]) assetIds.add(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };

  values.forEach(visit);
  return [...assetIds];
};

export const assertSurveyAssetReferences = async (
  repository: AssetRepository | undefined,
  actorUserId: string | undefined,
  values: unknown,
  tx?: PostgresTransaction,
): Promise<void> => {
  const assetIds = collectSurveyAssetIds(values);
  if (assetIds.length === 0) return;
  if (!repository || !actorUserId) {
    throw new ForbiddenException("survey_asset_owner_required");
  }

  const usable = await Promise.all(
    assetIds.map((assetId) =>
      repository.canUseAsSurveyReference(assetId, actorUserId, tx),
    ),
  );

  if (usable.some((isUsable) => !isUsable)) {
    throw new ForbiddenException("survey_asset_not_owned");
  }
};
