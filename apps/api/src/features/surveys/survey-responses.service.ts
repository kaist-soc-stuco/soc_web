import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { UsersService } from "../users/users.service";


import type { ResponseDetailResponse } from "@soc/contracts";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { SubmitResponseDto } from "./dto/submit-response.dto";
import { isoToMs, nowMs } from "@soc/shared";
import { validateSurveyAnswers } from "./survey-answer-validation";

@Injectable()
export class SurveyResponsesService {
  constructor(
    private readonly responsesRepo: SurveyResponsesRepository,
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly usersService: UsersService,
  ) {}

  private async getAllQuestionsForSurvey(surveyId: string): Promise<SurveyQuestionRecord[]> {
    const sections = await this.sectionsRepo.findBySurveyId(surveyId);
    const questionArrays = await Promise.all(
      sections.map((s) => this.questionsRepo.findBySectionId(s.id)),
    );
    return questionArrays.flat();
  }

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

    if (!survey.allowMultipleResponses) {
      const existing = await this.responsesRepo.findByUserAndSurvey(surveyId, caller.id);
      if (existing) {
        throw new ConflictException("already_submitted");
      }
    }

    if (survey.feePayersOnly) {
      const feeStatus = await this.usersService.getStudentFeeStatus(caller.id);
      if (!feeStatus || feeStatus.status !== "PAID") {
        throw new ForbiddenException("fee_payer_only");
      }
    }

    if (survey.maxResponses !== null) {
      const count = await this.responsesRepo.countSubmitted(surveyId);
      if (count >= survey.maxResponses) throw new ConflictException("survey_capacity_full");
    }

    const questions = await this.getAllQuestionsForSurvey(surveyId);
    validateSurveyAnswers(questions, dto.answers, now);

    const { response, answers } = await this.responsesRepo.insertSubmission({
      surveyId,
      userId: caller.id,
      answers: dto.answers,
    });

    return { ...response, answers };
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

    const questions = await this.getAllQuestionsForSurvey(surveyId);
    validateSurveyAnswers(questions, dto.answers, now);

    const { response, answers } = await this.responsesRepo.updateSubmission({
      responseId: existing.id,
      surveyId,
      answers: dto.answers,
    });

    return { ...response, answers };
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
