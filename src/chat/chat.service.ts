import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
// import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

// Tipado para uso de tokens
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Tipado seguro para metadata de respuesta
interface TokenUsageMetadata {
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Type guard para validar que un fragmento es de tipo texto
function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    Object.prototype.hasOwnProperty.call(part, 'type') &&
    Object.prototype.hasOwnProperty.call(part, 'text') &&
    (part as Record<string, unknown>).type === 'text' &&
    typeof (part as Record<string, unknown>).text === 'string'
  );
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
  ) {}

  async chatGPT(userMessage: string): Promise<{
    response: string;
    usage: TokenUsage;
  }> {
    const model = new ChatOpenAI({
      configuration: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      },
      model: 'openai/gpt-3.5-turbo', // o el modelo de OpenRouter que elijas
    });

    const messages = [
      new SystemMessage('Responde con claridad y brevedad.'),
      new HumanMessage(userMessage),
    ];

    // Tipamos la respuesta del modelo para evitar `any`
    const res = (await model.invoke(messages)) as {
      content: string | unknown[];
      response_metadata?: TokenUsageMetadata;
    };

    // Extraer el contenido
    const content =
      typeof res.content === 'string'
        ? res.content
        : res.content
            .map((part) => (isTextPart(part) ? part.text : ''))
            .join('');

    // Extraer el uso de tokens de forma segura y tipada
    const usage: TokenUsage = {
      promptTokens: res.response_metadata?.tokenUsage?.promptTokens ?? 0,
      completionTokens:
        res.response_metadata?.tokenUsage?.completionTokens ?? 0,
      totalTokens: res.response_metadata?.tokenUsage?.totalTokens ?? 0,
    };

    // Guardar los mensajes en la base de datos
    await this.messageRepo.save([
      { role: 'user', content: userMessage },
      { role: 'assistant', content },
    ]);

    return {
      response: content,
      usage,
    };
  }

  async chatOllama(userMessage: string): Promise<{ response: string }> {
    // const model = new ChatOllama({
    //   baseUrl: 'http://localhost:11434',
    //   model: 'tinyllama:latest',
    // });

    const model = new ChatOllama({
      model: 'tinyllama:latest',
    });

    const messages = [
      new SystemMessage('Responde con claridad y brevedad.'),
      new HumanMessage(userMessage),
    ];

    const res = (await model.invoke(messages)) as {
      content: string | unknown[];
    };

    const content =
      typeof res.content === 'string'
        ? res.content
        : res.content
            .map((part) => (isTextPart(part) ? part.text : ''))
            .join('');

    await this.messageRepo.save([
      { role: 'user', content: userMessage },
      { role: 'assistant', content },
    ]);

    return { response: content };
  }
}
