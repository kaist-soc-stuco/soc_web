import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';

import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(OptionalAuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get()
  page() {
    return this.chat.page();
  }
}

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatMessagesController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Post('messages')
  send(@Body() body: unknown) {
    return this.chat.send(body);
  }
}
