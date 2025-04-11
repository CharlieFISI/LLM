import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('chat')
@ApiTags('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('opengpt')
  @ApiOperation({ summary: 'Enviar un mensaje al modelo gpt-3.5' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '¿Cuál es la capital de Francia?' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Respuesta del modelo LLM' })
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
  @ApiOperation({ summary: 'Enviar un mensaje al modelo tinyllama' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: '¿Cuál es la capital de Francia?' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Respuesta del modelo LLM' })
  async sendMessageOllama(@Body('message') message: string): Promise<{
    response: string;
  }> {
    return await this.chatService.chatOllama(message);
  }
}
