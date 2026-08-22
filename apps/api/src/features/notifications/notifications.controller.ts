import { Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type {
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
} from "@soc/contracts";

import { AuthGuard } from "../auth/guards";
import { NotificationsService } from "./notifications.service";

interface AuthenticatedRequest extends Request {
  user?: { id: string; permission: number };
}

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("pageSize", new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listForUser(request.user!.id, {
      page,
      pageSize,
    });
  }

  @Patch("read-all")
  async markAllRead(
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationReadAllResponse> {
    return this.notificationsService.markAllRead(request.user!.id);
  }

  @Patch(":notificationId/read")
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param("notificationId") notificationId: string,
  ): Promise<NotificationReadResponse> {
    return this.notificationsService.markRead(request.user!.id, notificationId);
  }
}
