import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AuthSessionRepository } from "../auth/auth-session.repository";
import { UsersRepository } from "../users/repositories/users.repository";
import { UsersService } from "../users/users.service";
import { AuthGuard, OptionalAuthGuard, PermissionGuard } from "../../shared/guards";

import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";

import { SurveysService } from "./surveys.service";
import { SurveySectionsService } from "./survey-sections.service";
import { SurveyQuestionsService } from "./survey-questions.service";
import { SurveyResponsesService } from "./survey-responses.service";

import { SurveysController } from "./surveys.controller";
import { SurveySectionsController } from "./survey-sections.controller";
import { SurveyQuestionsController } from "./survey-questions.controller";
import { SurveyResponsesController } from "./survey-responses.controller";

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [
    SurveysController,
    SurveySectionsController,
    SurveyQuestionsController,
    SurveyResponsesController,
  ],
  providers: [
    // Infrastructure
    AuthSessionRepository,
    UsersRepository,
    UsersService,
    AuthGuard,
    OptionalAuthGuard,
    PermissionGuard,
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
  ],
})
export class SurveysModule {}
