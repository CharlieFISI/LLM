import { Module } from '@nestjs/common';
import { QuestionAnswerService } from './question-answer.service';
import { QuestionAnswerController } from './question-answer.controller';

@Module({
  providers: [QuestionAnswerService],
  controllers: [QuestionAnswerController]
})
export class QuestionAnswerModule {}
