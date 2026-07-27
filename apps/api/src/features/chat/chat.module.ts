import { Module } from '@nestjs/common';

import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ChatController, ChatMessagesController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ChatController, ChatMessagesController],
  providers: [ChatService, AuthGuard, OptionalAuthGuard],
})
export class ChatModule {}
