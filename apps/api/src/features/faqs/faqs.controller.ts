import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateFaqRequest,
  CreateFaqTopicRequest,
  PatchFaqRequest,
  PatchFaqTopicRequest,
  ReorderFaqTopicRequest,
} from '@soc/contracts';
import type { Request } from 'express';

import { AuthGuard } from '../../shared/guards';
import { FaqsService } from './faqs.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type AuthenticatedRequest = Request & { user: { id: string } };

function bodyWithKeys(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException(code);
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new UnprocessableEntityException(code);
  return value as Record<string, unknown>;
}

function uuid(value: string, code: string): string {
  if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException(code);
  return value;
}

@Controller('faqs')
export class PublicFaqsController {
  constructor(@Inject(FaqsService) private readonly faqs: FaqsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const value = bodyWithKeys(query, ['locale'], 'invalid_faq_query');
    return this.faqs.listPublic(value.locale);
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminFaqsController {
  constructor(@Inject(FaqsService) private readonly faqs: FaqsService) {}

  @Get('faqs')
  list(@Req() request: AuthenticatedRequest) {
    return this.faqs.listAdmin(request.user.id);
  }

  @Post('faq-topics')
  createTopic(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.faqs.createTopic(
      request.user.id,
      bodyWithKeys(body, ['titleKr', 'titleEn', 'displayOrder'], 'invalid_faq_topic') as unknown as CreateFaqTopicRequest,
    );
  }

  @Patch('faq-topics/:id')
  patchTopic(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.faqs.patchTopic(
      request.user.id,
      uuid(id, 'invalid_faq_topic_id'),
      bodyWithKeys(body, ['titleKr', 'titleEn'], 'invalid_faq_topic') as PatchFaqTopicRequest,
    );
  }

  @Delete('faq-topics/:id')
  @HttpCode(204)
  async deleteTopic(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.faqs.deleteTopic(request.user.id, uuid(id, 'invalid_faq_topic_id'));
  }

  @Put('faq-topics/:id/order')
  reorderTopic(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const value = bodyWithKeys(body, ['displayOrder'], 'invalid_faq_order') as unknown as ReorderFaqTopicRequest;
    return this.faqs.reorderTopic(request.user.id, uuid(id, 'invalid_faq_topic_id'), value.displayOrder);
  }

  @Post('faqs')
  createFaq(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.faqs.createFaq(
      request.user.id,
      bodyWithKeys(body, ['topicId', 'questionKr', 'questionEn', 'answerKr', 'answerEn', 'displayOrder', 'status'], 'invalid_faq') as unknown as CreateFaqRequest,
    );
  }

  @Patch('faqs/:id')
  patchFaq(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.faqs.patchFaq(
      request.user.id,
      uuid(id, 'invalid_faq_id'),
      bodyWithKeys(body, ['topicId', 'questionKr', 'questionEn', 'answerKr', 'answerEn', 'displayOrder', 'status'], 'invalid_faq') as PatchFaqRequest,
    );
  }

  @Delete('faqs/:id')
  @HttpCode(204)
  async deleteFaq(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.faqs.deleteFaq(request.user.id, uuid(id, 'invalid_faq_id'));
  }
}
