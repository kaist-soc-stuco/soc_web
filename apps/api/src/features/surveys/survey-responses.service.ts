import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveysRepository } from "./surveys.repository";
import { UsersService } from "../users/users.service";
import { AssetRepository } from "../asset/repositories/asset.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";


import type { ResponseDetailResponse } from "@soc/contracts";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { SubmitResponseDto } from "./dto/submit-response.dto";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import { isoToMs, nowMs } from "@soc/shared";
import { getSurveyEligibilityFailure } from "./survey-eligibility";
import { GoogleSurveySheetsService } from "./google-survey-sheets.service";
import type { TemporaryAccessTokenClaims } from "../auth/auth.types";

interface SurveyCaller {
  id?: string;
  permission: number;
  temporaryClaims?: TemporaryAccessTokenClaims;
}

@Injectable()
export class SurveyResponsesService {
  constructor(
    private readonly responsesRepo: SurveyResponsesRepository,
    private readonly surveysRepo: SurveysRepository,
    private readonly usersService: UsersService,
    @Optional() private readonly sectionsRepo?: SurveySectionsRepository,
    @Optional() private readonly questionsRepo?: SurveyQuestionsRepository,
    @Optional() private readonly assetRepository?: AssetRepository,
    @Optional() private readonly surveySheetsService?: GoogleSurveySheetsService,
  ) {}

  private async validateUploadedAssets(
    answers: SubmitResponseDto["answers"],
    userId: string,
    questions: SurveyQuestionRecord[] = [],
  ): Promise<void> {
    const assetRepository = this.assetRepository;
    if (!assetRepository) return;
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const assetInputs = answers.flatMap((answer) => {
      const content = answer.content;
      const ids = typeof content.assetId === "string"
        ? [content.assetId]
        : Array.isArray(content.assetIds)
          ? content.assetIds.filter((assetId): assetId is string => typeof assetId === "string")
          : [];
      return ids.map((assetId) => ({ assetId, question: questionById.get(answer.questionId) }));
    });
    const uniqueAssetIds = [...new Set(assetInputs.map((input) => input.assetId))];
    const ownedAssets = await Promise.all(
      uniqueAssetIds.map((assetId) => assetRepository.findOwnedAssetDetails(assetId, userId)),
    );
    if (ownedAssets.some((asset) => !asset)) {
      throw new ForbiddenException("answer_file_not_owned");
    }

    const assetById = new Map(
      ownedAssets.filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)).map((asset) => [asset.assetId, asset]),
    );
    for (const input of assetInputs) {
      const question = input.question;
      const asset = assetById.get(input.assetId);
      if (!asset || !question || question.questionType !== "file_upload") {
        throw new BadRequestException("answer_file_invalid");
      }

      const maxSizeBytes = question.config?.maxSizeBytes;
      if (maxSizeBytes !== undefined && asset.sizeBytes > maxSizeBytes) {
        throw new BadRequestException("answer_file_too_large");
      }

      const allowedMimeTypes = question.config?.allowedMimeTypes ?? [];
      if (
        allowedMimeTypes.length > 0 &&
        !allowedMimeTypes.some((allowed) =>
          allowed.endsWith("/*")
            ? asset.mimeType.toLowerCase().startsWith(`${allowed.slice(0, -1).toLowerCase()}`)
            : asset.mimeType.toLowerCase() === allowed.toLowerCase(),
        )
      ) {
        throw new BadRequestException("answer_file_type_not_allowed");
      }
    }
  }

  async submit(
    surveyId: string,
    dto: SubmitResponseDto,
    caller?: SurveyCaller,
  ): Promise<ResponseDetailResponse> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    if (!survey.isPublished) throw new NotFoundException("survey_not_found");

    const now = nowMs();
    if (survey.opensAt && isoToMs(survey.opensAt) > now)
      throw new ConflictException("survey_not_open_yet");
    if (survey.closesAt && isoToMs(survey.closesAt) <= now)
      throw new ConflictException("survey_closed");

    if (!caller && !survey.allowAnonymous) {
      throw new ForbiddenException("login_required");
    }

    if (caller?.temporaryClaims) {
      const eligibilityFailure = getSurveyEligibilityFailure({
        user: {
          academicStatus: caller.temporaryClaims.academicStatus ?? null,
          departmentKo: caller.temporaryClaims.department ?? null,
          departmentEn: null,
          primaryMajor: caller.temporaryClaims.primaryMajor ?? null,
        },
        eligibleSocAffiliations: survey.eligibleSocAffiliations ?? [],
        academicEligibility: survey.academicEligibility ?? "ANY",
      });
      if (eligibilityFailure) throw new ForbiddenException(eligibilityFailure);
    } else if (caller?.id) {
      if (typeof this.usersService.findById === "function") {
        const user = await this.usersService.findById(caller.id);
        if (!user) throw new ForbiddenException("login_required");
        const eligibilityFailure = getSurveyEligibilityFailure({
          user,
          eligibleSocAffiliations: survey.eligibleSocAffiliations ?? [],
          academicEligibility: survey.academicEligibility ?? "ANY",
        });
        if (eligibilityFailure) throw new ForbiddenException(eligibilityFailure);
      }
    }

    if (survey.feePayersOnly && caller) {
      if (!caller.id) {
        throw new ForbiddenException("fee_payer_only");
      }
      const feeStatus = await this.usersService.getStudentFeeStatus(caller.id);
      if (!feeStatus || feeStatus.status !== "PAID") {
        throw new ForbiddenException("fee_payer_only");
      }
    }

    const questions = this.sectionsRepo && this.questionsRepo
      ? await this.loadQuestions(surveyId)
      : [];
    if (caller?.temporaryClaims) {
      if (questions.some((question) => question.questionType === "file_upload")) {
        throw new ForbiddenException("login_required_for_file_upload");
      }
    } else if (caller?.id) {
      await this.validateUploadedAssets(dto.answers, caller.id, questions);
    } else if (questions.some((question) => question.questionType === "file_upload")) {
      throw new ForbiddenException("login_required_for_file_upload");
    }

    const submission = await this.responsesRepo.insertSubmission({
      surveyId,
      userId: caller?.id ?? null,
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

    await this.surveySheetsService?.enqueueRefresh(surveyId);
    return { ...submission.response, answers: submission.answers };
  }

  async findMine(
    surveyId: string,
    caller?: SurveyCaller,
  ): Promise<ResponseDetailResponse> {
    if (!caller?.id) throw new ForbiddenException("login_required");

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
    caller?: SurveyCaller,
  ): Promise<ResponseDetailResponse> {
    if (!caller?.id) throw new ForbiddenException("login_required");

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

    if (typeof this.usersService.findById === "function") {
      const user = await this.usersService.findById(caller.id);
      if (!user) throw new ForbiddenException("login_required");
      const eligibilityFailure = getSurveyEligibilityFailure({
        user,
        eligibleSocAffiliations: survey.eligibleSocAffiliations ?? [],
        academicEligibility: survey.academicEligibility ?? "ANY",
      });
      if (eligibilityFailure) throw new ForbiddenException(eligibilityFailure);
    }

    const questions = this.sectionsRepo && this.questionsRepo
      ? await this.loadQuestions(surveyId)
      : [];
    await this.validateUploadedAssets(dto.answers, caller.id, questions);

    const existing = await this.responsesRepo.findByUserAndSurvey(surveyId, caller.id);
    if (!existing) throw new NotFoundException("response_not_found");

    const update = await this.responsesRepo.updateSubmission({
      responseId: existing.id,
      surveyId,
      userId: caller.id,
      answers: dto.answers,
    });

    if (update.status === "updated") {
      await this.surveySheetsService?.enqueueRefresh(surveyId);
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

  private async loadQuestions(surveyId: string): Promise<SurveyQuestionRecord[]> {
    if (!this.questionsRepo) return [];
    const sections = await this.sectionsRepo!.findBySurveyId(surveyId);
    const questions = await Promise.all(
      sections.map((section) => this.questionsRepo!.findBySectionId(section.id)),
    );
    return questions.flat();
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
