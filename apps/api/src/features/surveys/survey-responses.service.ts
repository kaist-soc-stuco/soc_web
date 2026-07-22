import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveysRepository } from "./surveys.repository";
import { UsersService } from "../users/users.service";


import type { ResponseDetailResponse } from "@soc/contracts";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { SubmitResponseDto } from "./dto/submit-response.dto";
import { isoToMs, nowMs } from "@soc/shared";

@Injectable()
export class SurveyResponsesService {
  constructor(
    private readonly responsesRepo: SurveyResponsesRepository,
    private readonly surveysRepo: SurveysRepository,
    private readonly usersService: UsersService,
  ) {}

  async submit(
    surveyId: string,
    dto: SubmitResponseDto,
    caller?: { id: string; permission: number },
  ): Promise<ResponseDetailResponse> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    if (!survey.isPublished) throw new NotFoundException("survey_not_found");

    const now = nowMs();
    if (survey.opensAt && isoToMs(survey.opensAt) > now)
      throw new ConflictException("survey_not_open_yet");
    if (survey.closesAt && isoToMs(survey.closesAt) <= now)
      throw new ConflictException("survey_closed");

    if (!caller) {
      throw new ForbiddenException("login_required");
    }

    if (survey.feePayersOnly) {
      const feeStatus = await this.usersService.getStudentFeeStatus(caller.id);
      if (!feeStatus || feeStatus.status !== "PAID") {
        throw new ForbiddenException("fee_payer_only");
      }
    }

    const submission = await this.responsesRepo.insertSubmission({
      surveyId,
      userId: caller.id,
      answers: dto.answers,
    });

    if (submission.status === "survey_not_found") {
      throw new NotFoundException("survey_not_found");
    }
    if (submission.status === "survey_not_published") {
      throw new NotFoundException("survey_not_found");
    }
    if (submission.status === "survey_not_open_yet") {
      throw new ConflictException("survey_not_open_yet");
    }
    if (submission.status === "survey_closed") {
      throw new ConflictException("survey_closed");
    }
    if (submission.status === "fee_payer_only") {
      throw new ForbiddenException("fee_payer_only");
    }
    if (submission.status === "already_submitted") {
      throw new ConflictException("already_submitted");
    }
    if (submission.status === "capacity_full") {
      throw new ConflictException("survey_capacity_full");
    }

    return { ...submission.response, answers: submission.answers };
  }

  async findMine(
    surveyId: string,
    caller?: { id: string; permission: number },
  ): Promise<ResponseDetailResponse> {
    if (!caller) throw new ForbiddenException("login_required");

    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey || !survey.isPublished) {
      throw new NotFoundException("survey_not_found");
    }

    const response = await this.responsesRepo.findByUserAndSurvey(surveyId, caller.id);
    if (!response) throw new NotFoundException("response_not_found");

    const answers = await this.responsesRepo.findAnswersByResponseId(response.id);
    return { ...response, answers };
  }

  async updateMine(
    surveyId: string,
    dto: SubmitResponseDto,
    caller?: { id: string; permission: number },
  ): Promise<ResponseDetailResponse> {
    if (!caller) throw new ForbiddenException("login_required");

    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");
    if (!survey.isPublished) throw new NotFoundException("survey_not_found");
    if (!survey.allowResponseEdit) {
      throw new ConflictException("response_edit_not_allowed");
    }
    if (survey.allowMultipleResponses) {
      throw new ConflictException("multiple_response_edit_not_supported");
    }

    const now = nowMs();
    if (survey.opensAt && isoToMs(survey.opensAt) > now) {
      throw new ConflictException("survey_not_open_yet");
    }
    if (survey.closesAt && isoToMs(survey.closesAt) <= now) {
      throw new ConflictException("survey_closed");
    }

    if (survey.feePayersOnly) {
      const feeStatus = await this.usersService.getStudentFeeStatus(caller.id);
      if (!feeStatus || feeStatus.status !== "PAID") {
        throw new ForbiddenException("fee_payer_only");
      }
    }

    const existing = await this.responsesRepo.findByUserAndSurvey(surveyId, caller.id);
    if (!existing) throw new NotFoundException("response_not_found");

    const update = await this.responsesRepo.updateSubmission({
      responseId: existing.id,
      surveyId,
      userId: caller.id,
      answers: dto.answers,
    });

    if (update.status === "updated") {
      return { ...update.response, answers: update.answers };
    }
    if (
      update.status === "survey_not_found" ||
      update.status === "survey_not_published"
    ) {
      throw new NotFoundException("survey_not_found");
    }
    if (update.status === "survey_not_open_yet") {
      throw new ConflictException("survey_not_open_yet");
    }
    if (update.status === "survey_closed") {
      throw new ConflictException("survey_closed");
    }
    if (update.status === "fee_payer_only") {
      throw new ForbiddenException("fee_payer_only");
    }
    if (update.status === "response_edit_not_allowed") {
      throw new ConflictException("response_edit_not_allowed");
    }
    if (update.status === "multiple_response_edit_not_supported") {
      throw new ConflictException("multiple_response_edit_not_supported");
    }
    throw new NotFoundException("response_not_found");
  }

  async findAll(surveyId: string): Promise<SurveyResponseRecord[]> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");
    return this.responsesRepo.findBySurveyId(surveyId);
  }

  async findAllWithAnswers(surveyId: string): Promise<Array<SurveyResponseRecord & { answers: SurveyAnswerRecord[] }>> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");
    const responses = await this.responsesRepo.findBySurveyId(surveyId);
    const answers = await this.responsesRepo.findAnswersBySurveyId(surveyId);

    const answersMap: Record<string, SurveyAnswerRecord[]> = {};
    for (const a of answers) {
      if (!answersMap[a.responseId]) {
        answersMap[a.responseId] = [];
      }
      answersMap[a.responseId].push(a);
    }

    return responses.map((r) => ({
      ...r,
      answers: answersMap[r.id] || [],
    }));
  }

  async findDetail(surveyId: string, responseId: string): Promise<ResponseDetailResponse> {
    const response = await this.responsesRepo.findById(responseId, surveyId);
    if (!response) throw new NotFoundException("response_not_found");
    const answers = await this.responsesRepo.findAnswersByResponseId(responseId);
    return { ...response, answers };
  }
}
