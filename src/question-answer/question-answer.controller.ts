import { Body, Controller, Post } from '@nestjs/common';
import { QuestionAnswerService } from 'src/question-answer/question-answer.service';

@Controller('question-answer')
export class QuestionAnswerController {
  constructor(private readonly questionAnswerService: QuestionAnswerService) {}

  @Post('ollama-gemma3-allminilm')
  async questionOllamaGemma3AllMinilm(@Body() question: string) {
    return this.questionAnswerService.questionOllamaGemma3AllMinilm(question);
  }

  @Post('openai-35-turbo3-small')
  async questionOpenAI35Turbo3Small(@Body() question: string) {
    return this.questionAnswerService.questionOpenAI35Turbo3Small(question);
  }
}
