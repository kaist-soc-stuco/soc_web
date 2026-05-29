import { createAdminApi } from "./admin";
import { createAuthApi } from "./auth";
import { createBoardApi } from "./board";
import {
  ApiClientHttpError,
  createApiClientContext,
  type ApiClientOptions,
} from "./core";
import { createMiscApi } from "./misc";
import { createSurveyApi } from "./survey";

export { ApiClientHttpError };
export type { ApiClientOptions, ListQueryOptions } from "./core";

export const createApiClient = (options: ApiClientOptions) => {
  const context = createApiClientContext(options);

  return {
    ...createAuthApi(context),
    ...createBoardApi(context),
    ...createAdminApi(context),
    ...createSurveyApi(context),
    ...createMiscApi(context),
  };
};
