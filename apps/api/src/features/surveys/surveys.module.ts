import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AssetModule } from "../asset/asset.module";

import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";

import { SurveysService } from "./surveys.service";
import { SurveySectionsService } from "./survey-sections.service";
import { SurveyQuestionsService } from "./survey-questions.service";
import { SurveyResponsesService } from "./survey-responses.service";
import { SurveyMutationPolicy } from "./survey-mutation-policy";

import { SurveysController } from "./surveys.controller";
import { SurveySectionsController } from "./survey-sections.controller";
import { SurveyQuestionsController } from "./survey-questions.controller";
import { SurveyResponsesController } from "./survey-responses.controller";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, AssetModule],
  controllers: [
    SurveysController,
    SurveySectionsController,
    SurveyQuestionsController,
    SurveyResponsesController,
  ],
  providers: [
    // Survey repositories
    SurveysRepository,
    SurveySectionsRepository,
    SurveyQuestionsRepository,
    SurveyResponsesRepository,
    // Survey services
    SurveysService,
    SurveySectionsService,
    SurveyQuestionsService,
    SurveyResponsesService,
    SurveyMutationPolicy,
  ],
})
export class SurveysModule {}
