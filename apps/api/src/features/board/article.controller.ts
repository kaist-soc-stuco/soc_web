import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  ArticleDeleteResponse,
  ArticleEngagementResponse,
  ArticleModerationRequest,
  ArticleModerationResponse,
  HiddenArticleListResponse,
  FaqReorderRequest,
} from "@soc/contracts";
import { ArticleCreateSchema, ArticleModerationSchema, ArticleUpdateSchema, FaqReorderSchema } from "@soc/contracts";
import { Request, Response } from "express";

import { AuthGuard } from "../auth/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { AUTH_ACCESS_COOKIE_NAME } from "../auth/auth.tokens";
import { AuthSessionService } from "../auth/auth-session.service";
import { ArticleService } from "./article.service";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permission: number;
  };
}

@Controller("boards/:code/articles")
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Get()
  async getArticles(
    @Param("code") code: string,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("q") q?: string,
    @Query("searchBy") searchBy?: "title" | "title_content",
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<ArticleListResponse> {
    const currentUser =
      await this.authSessionService.getOptionalCurrentUser(accessToken);
    return this.articleService.getArticles(
      code,
      {
        page,
        limit,
        q,
        searchBy,
        includeContentPreview: code === "faq",
      },
      currentUser,
    );
  }

  @Get("moderation/hidden")
  @UseGuards(AuthGuard)
  async getHiddenArticles(
    @Param("code") code: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<HiddenArticleListResponse> {
    return this.articleService.listHiddenArticles(code, request.user!);
  }

  @Get(":articleId")
  async getArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken: string | undefined,
  ): Promise<ArticleDetailResponse> {
    const currentUser =
      await this.authSessionService.getOptionalCurrentUser(accessToken);

    const incrementView = true;

    return this.articleService.getArticle(
      code,
      articleId,
      currentUser,
      incrementView,
    );
  }

  @Post()
  @UseGuards(AuthGuard)
  async createArticle(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(ArticleCreateSchema)) body: ArticleCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleCreateResponse> {
    return this.articleService.createArticle(code, body, request.user!);
  }

  @Patch(":articleId")
  @UseGuards(AuthGuard)
  async updateArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Body(new ZodValidationPipe(ArticleUpdateSchema)) body: ArticleUpdateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleUpdateResponse> {
    return this.articleService.updateArticle(
      code,
      articleId,
      body,
      request.user!,
    );
  }

  @Delete(":articleId")
  @UseGuards(AuthGuard)
  async deleteArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDeleteResponse> {
    return this.articleService.deleteArticle(code, articleId, request.user!);
  }

  @Patch("admin/reorder")
  @UseGuards(AuthGuard)
  async reorderFaqArticles(
    @Body(new ZodValidationPipe(FaqReorderSchema)) body: FaqReorderRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    return this.articleService.reorderFaqArticles(body, request.user!);
  }

  @Post("admin")
  @UseGuards(AuthGuard)
  async createFaqArticle(
    @Body(new ZodValidationPipe(ArticleCreateSchema)) body: ArticleCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleCreateResponse> {
    return this.articleService.createFaqArticle(body, request.user!);
  }

  @Patch(":articleId/admin")
  @UseGuards(AuthGuard)
  async updateFaqArticle(
    @Param("articleId") articleId: string,
    @Body(new ZodValidationPipe(ArticleUpdateSchema)) body: ArticleUpdateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleUpdateResponse> {
    return this.articleService.updateFaqArticle(articleId, body, request.user!);
  }

  @Delete(":articleId/admin")
  @UseGuards(AuthGuard)
  async deleteFaqArticle(
    @Param("articleId") articleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDeleteResponse> {
    return this.articleService.deleteFaqArticle(articleId, request.user!);
  }

  @Post(":articleId/hide")
  @UseGuards(AuthGuard)
  async hideArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Body(new ZodValidationPipe(ArticleModerationSchema)) body: ArticleModerationRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleModerationResponse> {
    return this.articleService.hideArticle(code, articleId, body, request.user!);
  }

  @Post(":articleId/restore")
  @UseGuards(AuthGuard)
  async restoreArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleModerationResponse> {
    return this.articleService.restoreArticle(code, articleId, request.user!);
  }

  @Get(":articleId/anonymous-author")
  @UseGuards(AuthGuard)
  async revealAnonymousAuthor(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.articleService.revealAnonymousAuthor(code, articleId, request.user!);
  }

  @Put(":articleId/engagements/:kind")
  @UseGuards(AuthGuard)
  async activateArticleEngagement(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("kind") kind: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleEngagementResponse> {
    return this.articleService.setArticleEngagement(
      code,
      articleId,
      kind,
      true,
      request.user!,
    );
  }

  @Delete(":articleId/engagements/:kind")
  @UseGuards(AuthGuard)
  async deactivateArticleEngagement(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("kind") kind: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleEngagementResponse> {
    return this.articleService.setArticleEngagement(
      code,
      articleId,
      kind,
      false,
      request.user!,
    );
  }
}
