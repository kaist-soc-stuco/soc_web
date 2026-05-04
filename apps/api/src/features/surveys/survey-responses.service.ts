import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveysRepository } from "./surveys.repository";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import type { ResponseDetailResponse } from "@soc/contracts";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { SubmitResponseDto } from "./dto/submit-response.dto";
import type { ReviewResponseDto } from "./dto/review-response.dto";
import { isoToMs, isExpired, nowMs } from "@soc/shared";

@Injectable()
export class SurveyResponsesService {
  constructor(
    private readonly responsesRepo: SurveyResponsesRepository,
    private readonly surveysRepo: SurveysRepository,
  ) {}

  async submit(
    surveyId: string,
    dto: SubmitResponseDto,
    caller?: { id: string; permission: number },
  ): Promise<ResponseDetailResponse> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    if (survey.status !== "open") throw new ConflictException("survey_not_open");

    const now = nowMs();
    if (survey.opensAt && isoToMs(survey.opensAt) > now)
      throw new ConflictException("survey_not_open_yet");
    if (survey.closesAt && isExpired(isoToMs(survey.closesAt)))
      throw new ConflictException("survey_closed");

    if (!survey.allowAnonymous && !caller) {
      throw new ForbiddenException("login_required");
    }

    if (survey.feePayersOnly) {
      if (!caller || (caller.permission & PermissionFlags.TUITION_PAYER) === 0) {
        throw new ForbiddenException("fee_payer_only");
      }
    }

    if (survey.maxResponses !== null) {
      const count = await this.responsesRepo.countSubmitted(surveyId);
      if (count >= survey.maxResponses) throw new ConflictException("survey_capacity_full");
    }

    const response = await this.responsesRepo.insertResponse({
      surveyId,
      userId: caller?.id,
      externalPhone: dto.externalPhone,
    });

    const answers = await this.responsesRepo.insertAnswers(response.id, dto.answers);

    return { ...response, answers };
  }

  async findAll(surveyId: string): Promise<SurveyResponseRecord[]> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");
    return this.responsesRepo.findBySurveyId(surveyId);
  }

  async findDetail(surveyId: string, responseId: string): Promise<ResponseDetailResponse> {
    const response = await this.responsesRepo.findById(responseId, surveyId);
    if (!response) throw new NotFoundException("response_not_found");
    const answers = await this.responsesRepo.findAnswersByResponseId(responseId);
    return { ...response, answers };
  }

  async review(
    surveyId: string,
    responseId: string,
    adminId: string,
    dto: ReviewResponseDto,
  ): Promise<SurveyResponseRecord> {
    const response = await this.responsesRepo.updateReview(
      responseId,
      surveyId,
      adminId,
      dto.status,
      dto.reason,
    );
    if (!response) throw new NotFoundException("response_not_found");
    return response;
  }
}
