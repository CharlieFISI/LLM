import { Module } from '@nestjs/common';
import { QuestionAnswerService } from './question-answer.service';
import { QuestionAnswerController } from './question-answer.controller';
import { ChatMessages } from 'src/question-answer/entities/chat-messages.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessages])],
  providers: [QuestionAnswerService],
  controllers: [QuestionAnswerController],
})
export class QuestionAnswerModule {}
