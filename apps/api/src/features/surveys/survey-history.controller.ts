import { Body, Controller, Param, ParseUUIDPipe, Put, Req } from "@nestjs/common";
import { Permissions, RestoreSurveyStructureSchema, type RestoreSurveyStructureRequest } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { SurveyHistoryService } from "./survey-history.service";

@Controller("surveys")
export class SurveyHistoryController {
  constructor(private readonly history: SurveyHistoryService) {}

  @Put(":id/structure")
  @RequirePermissions(Permissions.MANAGE_SURVEY)
  restore(@Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RestoreSurveyStructureSchema)) body: RestoreSurveyStructureRequest,
    @Req() req: { user: { id: string } }) {
    return this.history.restore(id, body, req.user.id);
  }
}
