import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Put, Query, Req, Res, UnauthorizedException, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { SurveysService } from './surveys.service';

type SurveyRequest = Request & { user?: { id: string }; requestId?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value: string): string { if (!UUID.test(value)) throw new NotFoundException('survey_not_found'); return value; }
function locale(query: Record<string, unknown>): 'ko' | 'en' {
  if (Object.keys(query).some((key) => key !== 'locale')) {
    throw new UnprocessableEntityException('invalid_survey_query');
  }
  const value = query.locale;
  if (value === undefined) return 'ko';
  if (value === 'ko' || value === 'en') return value;
  throw new UnprocessableEntityException('invalid_survey_query');
}
function correlation(request: SurveyRequest): string { if (typeof request.requestId !== 'string' || !request.requestId.trim()) throw new Error('request_correlation_missing'); return request.requestId; }

@Controller('surveys')
@UseGuards(OptionalAuthGuard)
export class PublicSurveysController {
  constructor(@Inject(SurveysService) private readonly service: SurveysService) {}
  @Get() list(@Req() request: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.list(request.user?.id, locale(query)); }
  @Get('responses/me') mineAll(@Req() request: SurveyRequest) { if (!request.user) throw new UnauthorizedException('authentication_required'); return this.service.mineAll(request.user.id); }
  @Get('content-relations') related(@Query() query: Record<string, unknown>) { return this.service.related(query); }
  @Get(':id') get(@Req() request: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.get(request.user?.id, id(surveyId), locale(query)); }
  @Post(':id/responses') submit(@Req() request: SurveyRequest, @Param('id') surveyId: string, @Body() body: unknown) { return this.service.submit(request.user?.id, id(surveyId), body, correlation(request)); }
  @Get(':id/responses/me') mine(@Req() request: SurveyRequest, @Param('id') surveyId: string) { if (!request.user) throw new UnauthorizedException('authentication_required'); return this.service.mine(request.user.id, id(surveyId)); }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminSurveysController {
  constructor(@Inject(SurveysService) private readonly service: SurveysService) {}
  @Post('surveys') create(@Req() r: SurveyRequest, @Body() b: unknown) { return this.service.create(r.user!.id, b, correlation(r)); }
  @Patch('surveys/:id') patch(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Body() b: unknown) { return this.service.patch(r.user!.id, id(surveyId), b, correlation(r)); }
  @Post('surveys/:id/publish') publish(@Req() r: SurveyRequest, @Param('id') surveyId: string) { return this.service.publish(r.user!.id, id(surveyId), correlation(r)); }
  @Put('surveys/:id/sections') sections(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Body() b: unknown) { return this.service.sections(r.user!.id, id(surveyId), b, correlation(r)); }
  @Put('sections/:id/questions') questions(@Req() r: SurveyRequest, @Param('id') sectionId: string, @Body() b: unknown) { return this.service.questions(r.user!.id, id(sectionId), b, correlation(r)); }
  @Get('surveys/:id/responses') responses(@Req() r: SurveyRequest, @Param('id') surveyId: string) { return this.service.responses(r.user!.id, id(surveyId)); }
  @Get('survey-responses/:id') response(@Req() r: SurveyRequest, @Param('id') responseId: string) { return this.service.responseDetail(r.user!.id, id(responseId)); }
  @Post('survey-responses/:id/review') review(@Req() r: SurveyRequest, @Param('id') responseId: string, @Body() b: unknown) { return this.service.review(r.user!.id, id(responseId), b, correlation(r)); }
  @Get('surveys/:id/aggregate') aggregate(@Req() r: SurveyRequest, @Param('id') surveyId: string) { return this.service.aggregate(r.user!.id, id(surveyId)); }
  @Post('surveys/:id/export') async export(@Req() r: SurveyRequest, @Res() response: Response, @Param('id') surveyId: string, @Body() b: unknown) {
    const result = await this.service.export(r.user!.id, id(surveyId), b, correlation(r));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(HttpStatus.OK).send(result.csv);
  }
  @Get('content-matchers') matchers(@Req() r: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.listMatchers(r.user!.id, query); }
  @Post('content-matchers') matcher(@Req() r: SurveyRequest, @Body() b: unknown) { return this.service.matcher(r.user!.id, b, correlation(r)); }
  @Delete('content-matchers/:id') @HttpCode(HttpStatus.NO_CONTENT) async deleteMatcher(@Req() r: SurveyRequest, @Param('id') matcherId: string) { await this.service.deleteMatcher(r.user!.id, id(matcherId), correlation(r)); }
}
