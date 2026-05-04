import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  Req,
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
} from "@soc/contracts";
import { Request } from "express";

import { AuthGuard } from "../../shared/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
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
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<ArticleListResponse> {
    const currentUser =
      await this.authSessionService.getCurrentUser(accessToken);
    return this.articleService.getArticles(
      code,
      {
        page,
        limit,
      },
      currentUser,
    );
  }

  @Get(":articleId")
  async getArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<ArticleDetailResponse> {
    const currentUser =
      await this.authSessionService.getCurrentUser(accessToken);
    return this.articleService.getArticle(code, articleId, currentUser);
  }

  @Post()
  //@UseGuards(AuthGuard)
  async createArticle(
    @Param("code") code: string,
    @Body() body: ArticleCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleCreateResponse> {
    return this.articleService.createArticle(code, body, request.user!);
  }

  @Patch(":articleId")
  //@UseGuards(AuthGuard)
  async updateArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Body() body: ArticleUpdateRequest,
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
  //@UseGuards(AuthGuard)
  async deleteArticle(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDeleteResponse> {
    return this.articleService.deleteArticle(code, articleId, request.user!);
  }
}
