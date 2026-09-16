import { ForbiddenException } from "@nestjs/common";
import type { PostgresTransaction } from "../../infrastructure/postgres/postgres.provider";
import type { AssetRepository } from "../asset/repositories/asset.repository";

import { collectAssetReferenceIds } from "../asset/asset-reference";
export const collectSurveyAssetIds = collectAssetReferenceIds;

export const assertSurveyAssetReferences = async (
  repository: AssetRepository | undefined,
  actorUserId: string | undefined,
  values: unknown,
  tx?: PostgresTransaction,
  surveyId?: string,
): Promise<void> => {
  const assetIds = collectSurveyAssetIds(values);
  if (assetIds.length === 0) return;
  if (!repository || !actorUserId) {
    throw new ForbiddenException("survey_asset_owner_required");
  }

  const usable = await Promise.all(
    assetIds.map((assetId) =>
      repository.canUseAsSurveyReference(assetId, actorUserId, tx, surveyId),
    ),
  );

  if (usable.some((isUsable) => !isUsable)) {
    throw new ForbiddenException("survey_asset_not_owned");
  }
};
