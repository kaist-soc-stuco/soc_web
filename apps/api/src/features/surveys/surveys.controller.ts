import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post, Put, Query, Req, Res, UnauthorizedException, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
function responseQuery(query: Record<string, unknown>) {
  if (Object.keys(query).some((key) => !['state', 'limit', 'cursor', 'locale'].includes(key))) throw new UnprocessableEntityException('invalid_survey_response_query');
  const state = query.state === undefined ? 'SUBMITTED' : query.state;
  const limit = query.limit === undefined ? 25 : typeof query.limit === 'string' && /^\d+$/.test(query.limit) ? Number(query.limit) : NaN;
  if (!['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'].includes(String(state)) || !Number.isInteger(limit) || limit < 1 || limit > 100 || (query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 512)) || (query.locale !== undefined && query.locale !== 'ko' && query.locale !== 'en')) throw new UnprocessableEntityException('invalid_survey_response_query');
  return { state: state as 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED', limit, cursor: query.cursor as string | undefined, locale: (query.locale ?? 'ko') as 'ko' | 'en' };
}
function membershipPageQuery(query: Record<string, unknown>) {
  if (Object.keys(query).some((key) => !['set', 'limit', 'cursor', 'locale'].includes(key))) throw new UnprocessableEntityException('invalid_image_membership_page');
  const { locale: rawLocale, ...membership } = query;
  const requestedLocale: 'ko' | 'en' = rawLocale === undefined
    ? 'ko'
    : rawLocale === 'ko' || rawLocale === 'en'
      ? rawLocale
      : (() => { throw new UnprocessableEntityException('invalid_image_membership_page'); })();
  if (membership.limit !== undefined) { if (typeof membership.limit !== 'string' || !/^\d+$/.test(membership.limit)) throw new UnprocessableEntityException('invalid_image_membership_page'); membership.limit = Number(membership.limit); }
  return { membership, requestedLocale };
}
function correlation(request: SurveyRequest): string { if (typeof request.requestId !== 'string' || !request.requestId.trim()) throw new Error('request_correlation_missing'); return request.requestId; }

@Controller('surveys')
@UseGuards(OptionalAuthGuard)
export class PublicSurveysController {
  constructor(@Inject(SurveysService) private readonly service: SurveysService) {}
  @Get() list(@Req() request: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.list(request.user?.id, locale(query)); }
  @Get('responses/me') mineAll(@Req() request: SurveyRequest, @Query() query: Record<string, unknown>) { if (!request.user) throw new UnauthorizedException('authentication_required'); return this.service.mineAll(request.user.id, locale(query)); }
  @Get('content-relations') related(@Query() query: Record<string, unknown>) { return this.service.related(query); }
  @Get(':surveyId/image-blocks/:blockId/memberships') publicImageMembershipPage(@Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Query() query: Record<string, unknown>) { const { membership, requestedLocale } = membershipPageQuery(query); return this.service.imageMembershipPage(undefined, id(surveyId), id(blockId), membership, requestedLocale); }
  @Get(':id/images/:imageId') async image(@Res() response: Response, @Param('id') surveyId: string, @Param('imageId') imageId: string) {
    const image = await this.service.publicImage(id(surveyId), id(imageId));
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', image.contentType);
    response.setHeader('Content-Length', String(image.contentLength));
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(Readable.from(image.body as unknown as AsyncIterable<Uint8Array>), response);
  }
  @Get(':id') get(@Req() request: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.get(request.user?.id, id(surveyId), locale(query)); }
  @Post(':id/responses') submit(@Req() request: SurveyRequest, @Param('id') surveyId: string, @Body() body: unknown) { return this.service.submit(request.user?.id, id(surveyId), body, correlation(request)); }
  @Get(':id/responses/me') mine(@Req() request: SurveyRequest, @Param('id') surveyId: string) { if (!request.user) throw new UnauthorizedException('authentication_required'); return this.service.mine(request.user.id, id(surveyId)); }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminSurveysController {
  constructor(@Inject(SurveysService) private readonly service: SurveysService) {}
  @Get('surveys') managedList(@Req() r: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.listManaged(r.user!.id, locale(query)); }
  @Get('surveys/review-queue') reviewQueue(@Req() r: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.reviewQueue(r.user!.id, locale(query)); }
  @Post('surveys') create(@Req() r: SurveyRequest, @Body() b: unknown) { return this.service.create(r.user!.id, b, correlation(r)); }
  @Get('surveys/:id') managedGet(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.adminRequestedLocale(r.user!.id, id(surveyId), locale(query)); }
  @Patch('surveys/:id') patch(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Body() b: unknown) { return this.service.patch(r.user!.id, id(surveyId), b, correlation(r)); }
  @Post('surveys/:id/publish') publish(@Req() r: SurveyRequest, @Param('id') surveyId: string) { return this.service.publish(r.user!.id, id(surveyId), correlation(r)); }
  @Put('surveys/:id/definition') definition(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Body() b: unknown) { return this.service.definition(r.user!.id, id(surveyId), b, correlation(r)); }
  @Get('surveys/:surveyId/image-blocks/:blockId/memberships') imageMembershipPage(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Query() query: Record<string, unknown>) { const { membership, requestedLocale } = membershipPageQuery(query); return this.service.imageMembershipPage(r.user!.id, id(surveyId), id(blockId), membership, requestedLocale); }
  @Post('surveys/:surveyId/image-blocks/:blockId/memberships') addImageMembership(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Body() b: unknown) { return this.service.addImageMembership(r.user!.id, id(surveyId), id(blockId), b, correlation(r)); }
  @Delete('surveys/:surveyId/image-blocks/:blockId/memberships/:membershipId') removeImageMembership(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Param('membershipId') membershipId: string, @Body() b: unknown) { return this.service.removeImageMembership(r.user!.id, id(surveyId), id(blockId), id(membershipId), b, correlation(r)); }
  @Patch('surveys/:surveyId/image-blocks/:blockId/memberships/:membershipId') moveImageMembership(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Param('membershipId') membershipId: string, @Body() b: unknown) { return this.service.moveImageMembership(r.user!.id, id(surveyId), id(blockId), id(membershipId), b, correlation(r)); }
  @Post('surveys/:surveyId/image-blocks/:blockId/mode') changeImageBlockMode(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('blockId') blockId: string, @Body() b: unknown) { return this.service.changeImageBlockMode(r.user!.id, id(surveyId), id(blockId), b, correlation(r)); }
  @Post('survey-image-assets/v2/initiate') initiateImageAssetV2(@Req() r: SurveyRequest, @Body() b: unknown) { return this.service.initiateImageAssetV2(r.user!.id, b); }
  @Post('survey-image-assets/:id/v2/complete') completeImageAssetV2(@Req() r: SurveyRequest, @Param('id') imageId: string, @Body() b: unknown) { return this.service.completeImageAssetV2(r.user!.id, id(imageId), b); }
  @Post('surveys/:id/materialize-event') materializeEvent(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Body() b: unknown) { return this.service.materializeEvent(r.user!.id, id(surveyId), b, correlation(r)); }
  @Get('surveys/:id/responses') responses(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.responses(r.user!.id, id(surveyId), responseQuery(query)); }
  @Get('surveys/:surveyId/responses/:responseId') response(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('responseId') responseId: string, @Query() query: Record<string, unknown>) { return this.service.responseDetail(r.user!.id, id(surveyId), id(responseId), locale(query)); }
  @Post('surveys/:surveyId/responses/:responseId/review') review(@Req() r: SurveyRequest, @Param('surveyId') surveyId: string, @Param('responseId') responseId: string, @Query() query: Record<string, unknown>, @Body() b: unknown) { return this.service.review(r.user!.id, id(surveyId), id(responseId), b, locale(query), correlation(r)); }
  @Get('surveys/:id/aggregate') @Header('Cache-Control', 'private, no-store') aggregate(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.aggregate(r.user!.id, id(surveyId), locale(query)); }
  @Get('surveys/:id/aggregate/v2') @Header('Cache-Control', 'private, no-store') aggregateV2(@Req() r: SurveyRequest, @Param('id') surveyId: string, @Query() query: Record<string, unknown>) { return this.service.aggregateV2(r.user!.id, id(surveyId), locale(query)); }
  @Post('surveys/:id/export') @HttpCode(HttpStatus.OK) async export(@Req() r: SurveyRequest, @Res() response: Response, @Param('id') surveyId: string, @Body() b: unknown) {
    const result = await this.service.export(r.user!.id, id(surveyId), b, correlation(r));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(Readable.from(result.chunks), response);
  }
  @Get('content-matchers') matchers(@Req() r: SurveyRequest, @Query() query: Record<string, unknown>) { return this.service.listMatchers(r.user!.id, query); }
  @Post('content-matchers') matcher(@Req() r: SurveyRequest, @Body() b: unknown) { return this.service.matcher(r.user!.id, b, correlation(r)); }
  @Delete('content-matchers/:id') @HttpCode(HttpStatus.NO_CONTENT) async deleteMatcher(@Req() r: SurveyRequest, @Param('id') matcherId: string) { await this.service.deleteMatcher(r.user!.id, id(matcherId), correlation(r)); }
}
