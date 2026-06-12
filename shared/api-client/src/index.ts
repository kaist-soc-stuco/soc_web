import { createAdminApi } from "./admin.js";
import { createAuthApi } from "./auth.js";
import { createBoardApi } from "./board.js";
import { createCalendarApi } from "./calendar.js";
import {
  ApiClientHttpError,
  createApiClientContext,
  type ApiClientOptions,
} from "./core.js";
import { createMiscApi } from "./misc.js";
import { createSurveyApi } from "./survey.js";

export { ApiClientHttpError };
export type { ApiClientOptions, ListQueryOptions } from "./core.js";

export const createApiClient = (options: ApiClientOptions) => {
  const context = createApiClientContext(options);

  return {
    ...createAuthApi(context),
    ...createBoardApi(context),
    ...createCalendarApi(context),
    ...createAdminApi(context),
    ...createSurveyApi(context),
    ...createMiscApi(context),
  };
};
