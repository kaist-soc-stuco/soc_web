import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import type { ArticleListItem, ArticleListResponse } from "@soc/contracts";

import { ArticleService } from "./article.service";
import { Cookies } from "../../shared/decorators/cookies.decorator";
import { AUTH_ACCESS_COOKIE_NAME } from "../auth/auth.tokens";
import { AuthSessionService } from "../auth/auth-session.service";

@Controller("articles")
export class ArticleSearchController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Get()
  async listArticles(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("q") q?: string,
    @Query("searchBy") searchBy?: "title" | "author" | "title_content",
    @Query("sortBy") sortBy?: "latest" | "views",
    @Query("sortDirection") sortDirection?: "asc" | "desc",
    @Query("period") period?: "all" | "7days" | "30days",
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<ArticleListResponse> {
    const currentUser =
      await this.authSessionService.getCurrentUser(accessToken);

    return this.articleService.getAllArticles(
      {
        limit,
        page,
        period,
        q,
        searchBy,
        sortBy,
        sortDirection,
      },
      currentUser,
    );
  }

  @Get("search")
  async searchArticles(
    @Query("q") q?: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ArticleListItem[]> {
    return this.articleService.searchArticles(q, limit);
  }
}
