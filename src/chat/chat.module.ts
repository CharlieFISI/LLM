import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Message } from 'src/chat/entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmChat } from './entities/crm_chat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, CrmChat])],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
