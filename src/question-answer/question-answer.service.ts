import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { AppDataSource } from 'src/data-source';
import { ChatMessages } from 'src/question-answer/entities/chat-messages.entity';
import { Repository } from 'typeorm';

@Injectable()
export class QuestionAnswerService {
  constructor(
    @InjectRepository(ChatMessages)
    private chatMessagesRepository: Repository<ChatMessages>,
  ) {}

  async questionOllamaGemma3AllMinilm(question: string) {
    const embeddings = new OllamaEmbeddings({ model: 'all-minilm' });
    const vectorStore = await TypeORMVectorStore.fromDataSource(embeddings, {
      postgresConnectionOptions: AppDataSource,
      tableName: 'document_ollama_allminilm',
    });

    const retriever = vectorStore.asRetriever();
    const prompt = ChatPromptTemplate.fromTemplate(`
      Eres un asistente útil que responde preguntas basado estrictamente en los documentos proporcionados.

      Contexto:
      {context}

      Pregunta:
      {input}
    `);
    const llm = new ChatOllama({ model: 'gemma3:latest' });

    const chain = await createRetrievalChain({
      combineDocsChain: RunnableSequence.from([prompt, llm]),
      retriever,
    });

    const response = await chain.invoke({ input: question });
    await this.chatMessagesRepository.save([
      {
        role: 'user',
        content: question,
      },
      {
        role: 'assistant',
        content: String(response.answer?.content),
        chatModel: 'Gemma3',
        embeddingModel: 'All-minilm',
      },
    ]);
    return String(response.answer?.content ?? 'No se encontró respuesta');
  }

  async questionOpenAI35Turbo3Small(question: string) {
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });
    const vectorStore = await TypeORMVectorStore.fromDataSource(embeddings, {
      postgresConnectionOptions: AppDataSource,
      tableName: 'document_openai_3small',
    });

    const retriever = vectorStore.asRetriever();
    const prompt = ChatPromptTemplate.fromTemplate(`
      Eres un asistente útil que responde preguntas basado estrictamente en los documentos proporcionados.

      Contexto:
      {context}

      Pregunta:
      {input}
    `);
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
    });

    const chain = await createRetrievalChain({
      combineDocsChain: RunnableSequence.from([prompt, llm]),
      retriever,
    });

    const response = await chain.invoke({ input: question });
    await this.chatMessagesRepository.save([
      {
        role: 'user',
        content: question,
      },
      {
        role: 'assistant',
        content: String(response.answer?.content),
        chatModel: 'GPT-3.5-turbo',
        embeddingModel: 'Text-embedding-3-small',
      },
    ]);
    return String(response.answer?.content ?? 'No se encontró respuesta');
  }
}
