import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuestionAnswerService } from 'src/question-answer/question-answer.service';
import { ApiKeyGuard } from 'src/common/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('question-answer')
@ApiTags('chat')
export class QuestionAnswerController {
  constructor(private readonly questionAnswerService: QuestionAnswerService) {}

  @Post('ollama-gemma3-allminilm')
  async questionOllamaGemma3AllMinilm(@Body() body: { question: string }) {
    return this.questionAnswerService.questionOllamaGemma3AllMinilm(
      body.question,
    );
  }

  @Post('openai-35-turbo3-small')
  async questionOpenAI35Turbo3Small(@Body() body: { question: string }) {
    return this.questionAnswerService.questionOpenAI35Turbo3Small(
      body.question,
    );
  }

  @Post('consult-query-crm-openai-35-turbo3-small')
  async consultQueryCRMOpenAI35Turbo3Small(@Body() body: { question: string }) {
    return this.questionAnswerService.consultQueryCRMOpenAI35Turbo3Small(
      body.question,
    );
  }

  @Post('consult-query-crm-openai-4o-mini3-small')
  async consultQueryCRMOpenAI4oMini3Small(@Body() body: { question: string }) {
    return this.questionAnswerService.consultQueryCRMOpenAI4oMini3Small(
      body.question,
    );
  }
}
