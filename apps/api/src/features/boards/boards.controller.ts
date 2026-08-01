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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { ArticlesService } from './articles.service';
import { BoardsService } from './boards.service';
import { InteractionsService } from './interactions.service';
import {
  parseArticleDetailQuery,
  parseArticleId,
  parseArticleListQuery,
  parseAssetId,
  parseBoardCode,
  parseBoardDetailQuery,
  parseBoardId,
  parseBoardListQuery,
  parseCommentId,
  parseCompleteAssetRequest,
  parseCreateArticleRequest,
  parseCreateBoardRequest,
  parseCreateCommentRequest,
  parseDeleteBoardRequest,
  parseInitiateAssetRequest,
  parsePatchArticleRequest,
  parsePatchBoardRequest,
  parsePatchCommentRequest,
  parsePutArticleReactionRequest,
} from './boards.validation';

type OptionalRequest = Request & { user?: { id: string } };
type AuthenticatedRequest = Request & { requestId: string; user: { id: string } };

@Controller('boards')
@UseGuards(OptionalAuthGuard)
export class PublicBoardsController {
  constructor(
    @Inject(BoardsService) private readonly boards: BoardsService,
    @Inject(ArticlesService) private readonly articles: ArticlesService,
  ) {}

  @Get()
  list(@Req() request: OptionalRequest, @Query() query: unknown) {
    return this.boards.list(request.user?.id, parseBoardListQuery(query));
  }

  @Get(':code')
  get(@Req() request: OptionalRequest, @Param('code') code: unknown, @Query() query: unknown) {
    const { locale } = parseBoardDetailQuery(query);
    return this.boards.get(request.user?.id, parseBoardCode(code), locale);
  }

  @Get(':code/articles')
  listArticles(@Req() request: OptionalRequest, @Param('code') code: unknown, @Query() query: unknown) {
    return this.articles.list(request.user?.id, parseBoardCode(code), parseArticleListQuery(query));
  }
}

@Controller('articles')
@UseGuards(OptionalAuthGuard)
export class PublicArticlesController {
  constructor(
    @Inject(ArticlesService) private readonly articles: ArticlesService,
    @Inject(InteractionsService) private readonly interactions: InteractionsService,
  ) {}

  @Get(':id')
  async get(@Req() request: OptionalRequest, @Param('id') id: unknown, @Query() query: unknown) {
    const locale = parseArticleDetailQuery(query).locale ?? 'ko';
    const articleId = parseArticleId(id);
    const article = await this.articles.get(request.user?.id, articleId, locale);
    const { comments, assets, myReaction, likeCount } = await this.interactions.detailExtras(request.user?.id, articleId);
    return { locale, article, comments, assets, myReaction, likeCount };
  }
}

@Controller('admin/boards')
@UseGuards(AuthGuard)
export class AdminBoardsController {
  constructor(@Inject(BoardsService) private readonly boards: BoardsService) {}
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.boards.adminList(request.user.id);
  }


  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.boards.create(request.user.id, parseCreateBoardRequest(body), request.requestId);
  }

  @Patch(':id')
  patch(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.boards.patch(request.user.id, parseBoardId(id), parsePatchBoardRequest(body), request.requestId);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown): Promise<void> {
    const { expectedUpdatedAt } = parseDeleteBoardRequest(body);
    await this.boards.delete(request.user.id, parseBoardId(id), expectedUpdatedAt, request.requestId);
  }
}

@Controller()
@UseGuards(AuthGuard)
export class BoardWritesController {
  constructor(
    @Inject(ArticlesService) private readonly articles: ArticlesService,
    @Inject(InteractionsService) private readonly interactions: InteractionsService,
  ) {}

  @Post('boards/:code/articles')
  @HttpCode(201)
  createArticle(@Req() request: AuthenticatedRequest, @Param('code') code: unknown, @Body() body: unknown) {
    return this.articles.create(request.user.id, parseBoardCode(code), parseCreateArticleRequest(body), request.requestId);
  }

  @Patch('articles/:id')
  patchArticle(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.articles.patch(request.user.id, parseArticleId(id), parsePatchArticleRequest(body), request.requestId);
  }

  @Delete('articles/:id')
  @HttpCode(204)
  async deleteArticle(@Req() request: AuthenticatedRequest, @Param('id') id: unknown): Promise<void> {
    await this.articles.softDelete(request.user.id, parseArticleId(id), request.requestId);
  }

  @Post('articles/:id/publish')
  @HttpCode(200)
  publishArticle(@Req() request: AuthenticatedRequest, @Param('id') id: unknown) {
    return this.articles.publish(request.user.id, parseArticleId(id), request.requestId);
  }

  @Post('articles/:id/comments')
  @HttpCode(201)
  createComment(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.interactions.createComment(request.user.id, parseArticleId(id), parseCreateCommentRequest(body), request.requestId);
  }

  @Patch('comments/:id')
  patchComment(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.interactions.patchComment(request.user.id, parseCommentId(id), parsePatchCommentRequest(body), request.requestId);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  async deleteComment(@Req() request: AuthenticatedRequest, @Param('id') id: unknown): Promise<void> {
    await this.interactions.deleteComment(request.user.id, parseCommentId(id), request.requestId);
  }

  @Put('articles/:id/reaction')
  putReaction(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.interactions.putReaction(request.user.id, parseArticleId(id), parsePutArticleReactionRequest(body), request.requestId);
  }

  @Delete('articles/:id/reaction')
  deleteReaction(@Req() request: AuthenticatedRequest, @Param('id') id: unknown) {
    return this.interactions.deleteReaction(request.user.id, parseArticleId(id), request.requestId);
  }

  @Post('articles/:id/assets/initiate')
  @HttpCode(201)
  initiateAsset(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.interactions.initiateAsset(request.user.id, parseArticleId(id), parseInitiateAssetRequest(body), request.requestId);
  }

  @Post('assets/:id/complete')
  @HttpCode(200)
  completeAsset(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown) {
    return this.interactions.completeAsset(request.user.id, parseAssetId(id), parseCompleteAssetRequest(body), request.requestId);
  }

  @Delete('assets/:id')
  @HttpCode(204)
  async deleteAsset(@Req() request: AuthenticatedRequest, @Param('id') id: unknown): Promise<void> {
    await this.interactions.deleteAsset(request.user.id, parseAssetId(id), request.requestId);
  }
}
