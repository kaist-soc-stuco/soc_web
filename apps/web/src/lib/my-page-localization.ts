import type {
  MyActivityItem,
  MyArticleItem,
  MyCommentItem,
  MySurveyResponseItem,
} from "@soc/contracts";

import { getLocalizedText, type Language } from "./i18n";

type DisplayLanguage = Language | string;

export interface MyPageActivityDisplay {
  context: string | null;
  title: string;
}

export function getMyActivityTitle(
  lang: DisplayLanguage,
  item: Pick<MyActivityItem, "titleKo" | "titleEn">,
) {
  return getLocalizedText(lang, item.titleKo, item.titleEn);
}

export function getMyActivityDisplay(
  lang: DisplayLanguage,
  item: Pick<
    MyActivityItem,
    "commentContent" | "titleEn" | "titleKo" | "type"
  >,
): MyPageActivityDisplay {
  const localizedTitle = getMyActivityTitle(lang, item);
  const commentContent = item.commentContent?.trim();

  if (item.type !== "comment" || !commentContent) {
    return { context: null, title: localizedTitle };
  }

  return { context: localizedTitle, title: commentContent };
}

export function getMyArticleTitle(
  lang: DisplayLanguage,
  item: Pick<MyArticleItem, "titleKo" | "titleEn">,
) {
  return getLocalizedText(lang, item.titleKo, item.titleEn);
}

export function getMyCommentArticleTitle(
  lang: DisplayLanguage,
  item: Pick<MyCommentItem, "articleTitleKo" | "articleTitleEn">,
) {
  return getLocalizedText(lang, item.articleTitleKo, item.articleTitleEn);
}

export function getMyCommentDisplay(
  lang: DisplayLanguage,
  item: Pick<
    MyCommentItem,
    "articleTitleEn" | "articleTitleKo" | "content"
  >,
): MyPageActivityDisplay {
  const articleTitle = getMyCommentArticleTitle(lang, item);
  const commentContent = item.content.trim();

  if (!commentContent) {
    return { context: null, title: articleTitle };
  }

  return { context: articleTitle, title: commentContent };
}

export function getMySurveyTitle(
  lang: DisplayLanguage,
  item: Pick<MySurveyResponseItem, "surveyTitleKo" | "surveyTitleEn">,
) {
  return getLocalizedText(lang, item.surveyTitleKo, item.surveyTitleEn);
}
