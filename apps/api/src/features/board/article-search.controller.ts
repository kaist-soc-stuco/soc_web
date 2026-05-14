import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import type { ArticleListItem } from "@soc/contracts";

import { ArticleService } from "./article.service";

@Controller("articles")
export class ArticleSearchController {
  constructor(private readonly articleService: ArticleService) {}

  @Get("search")
  async searchArticles(
    @Query("q") q?: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ArticleListItem[]> {
    return this.articleService.searchArticles(q, limit);
  }
}
