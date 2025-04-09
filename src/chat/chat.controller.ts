import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('opengpt')
  async sendMessageGPT(@Body('message') message: string): Promise<{
    response: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    return await this.chatService.chatGPT(message);
  }

  @Post('ollama')
  async sendMessageOllama(@Body('message') message: string): Promise<{
    response: string;
  }> {
    return await this.chatService.chatOllama(message);
  }
}
