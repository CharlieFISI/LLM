import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AskCrmDto } from 'src/files/dto/create-file.dto';
import { ApiKeyGuard } from 'src/common/api-key.guard';

@UseGuards(ApiKeyGuard)
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

  @Post('ask-crm-db')
  @ApiOperation({ summary: 'Haz una pregunta sobre la base de datos del CRM' })
  async questionCrmDb(@Body() body: AskCrmDto) {
    return this.chatService.questionCrmDb(body);
  }

  @Get('list-crm-chats/:user_id/:message_number')
  @ApiOperation({ summary: 'Lista los chats del CRM por usuario' })
  async listCrmChatByUser(@Param('user_id') user_id: string, @Param('message_number') message_number: string) {
    return this.chatService.listCrmChatByUser(+user_id, +message_number);
  }
}
