import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationType,
} from "@soc/contracts";
import { nowIso } from "@soc/shared";

import { NotificationsRepository } from "./notifications.repository";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async listForUser(
    userId: string,
    input: { page?: number; pageSize?: number },
  ): Promise<NotificationListResponse> {
    const page = Number.isFinite(input.page)
      ? Math.max(1, Math.floor(input.page!))
      : 1;
    const pageSize = Number.isFinite(input.pageSize)
      ? Math.min(50, Math.max(1, Math.floor(input.pageSize!)))
      : 20;

    return this.notificationsRepository.listForUser(userId, page, pageSize);
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationReadResponse> {
    const result = await this.notificationsRepository.markRead(userId, notificationId);
    if (!result) throw new NotFoundException("notification_not_found");

    return {
      notificationId: result.notificationId,
      isRead: true,
      readAt: result.readAt ?? nowIso(),
    };
  }

  async markAllRead(userId: string): Promise<NotificationReadAllResponse> {
    return {
      updatedCount: await this.notificationsRepository.markAllRead(userId),
      readAt: nowIso(),
    };
  }

  async notifyCommentCreated(input: {
    articleId: string;
    articleTitleKo: string;
    boardCode: string;
    commentId: string;
    actorUserId: string;
    articleAuthorUserId: string;
    parentCommentAuthorUserId?: string | null;
    isReply: boolean;
    isOfficial: boolean;
  }): Promise<void> {
    const recipients = new Set(
      [input.articleAuthorUserId, input.parentCommentAuthorUserId]
        .filter((userId): userId is string => Boolean(userId))
        .filter((userId) => userId !== input.actorUserId),
    );

    for (const userId of recipients) {
      const isOfficial = input.isOfficial && userId === input.articleAuthorUserId;
      const isReply =
        input.isReply && userId === input.parentCommentAuthorUserId;
      try {
        await this.notificationsRepository.create({
          actorUserId: input.actorUserId,
          bodyKo: isOfficial
            ? `건의사항에 학생회의 공식 답변이 등록되었습니다: ${input.articleTitleKo}`
            : isReply
            ? `회원님의 댓글에 새 답글이 달렸습니다: ${input.articleTitleKo}`
            : `회원님의 게시글에 새 댓글이 달렸습니다: ${input.articleTitleKo}`,
          link: input.boardCode === "_EVENT"
            ? `/events/${input.articleId}#comment-${input.commentId}`
            : `/board/${input.boardCode}/${input.articleId}#comment-${input.commentId}`,
          titleKo: isOfficial ? "건의사항에 공식 답변이 등록되었습니다" : isReply ? "내 댓글에 답글이 달렸습니다" : "내 게시글에 댓글이 달렸습니다",
          type: isOfficial ? ("OFFICIAL_RESPONSE" as NotificationType) : isReply ? ("REPLY_TO_COMMENT" as NotificationType) : ("COMMENT_ON_ARTICLE" as NotificationType),
          userId,
        });
      } catch (error) {
        // 댓글 저장 성공을 알림 저장 실패 때문에 500으로 바꾸지 않습니다.
        this.logger.warn(
          `notification_create_failed user=${userId} comment=${input.commentId} ${String(error)}`,
        );
      }
    }
  }
}
