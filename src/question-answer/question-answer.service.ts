import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { AppDataSource, CRMDataSource } from 'src/data-source';
import { ChatMessages } from 'src/question-answer/entities/chat-messages.entity';
import { DataSource, Repository } from 'typeorm';

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

  async consultQueryCRMOpenAI35Turbo3Small(question: string) {
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });

    const vectorStore = await TypeORMVectorStore.fromExistingIndex(embeddings, {
      postgresConnectionOptions: AppDataSource,
      tableName: 'schema_embeddings',
    });

    const retriever = vectorStore.asRetriever();

    const prompt = ChatPromptTemplate.fromTemplate(`
  Eres un asistente experto en SQL que genera únicamente consultas PostgreSQL válidas.

  Tu tarea es generar **solo** consultas SQL basadas **exclusivamente** en el contexto del esquema proporcionado.

  No inventes tablas ni campos. No utilices nombres como 'table_name' o 'column_name'.

  Contexto del esquema de la base de datos:
  {context}

  Consulta solicitada:
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

    const result = await chain.invoke({
      input: question,
    });

    const generatedQuery = String(result.answer?.content ?? '').trim();

    if (!generatedQuery.toLowerCase().startsWith('select')) {
      throw new Error('El modelo no generó una consulta SQL válida.');
    }

    const dataSource = new DataSource(CRMDataSource);
    if (!dataSource.isInitialized) await dataSource.initialize();

    const queryResult = await dataSource.query(generatedQuery);

    return {
      query: generatedQuery,
      result: queryResult,
    };
  }

  async consultQueryCRMOpenAI4oMini3Small(question: string) {
    let generatedQuery = '';
    try {
      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'text-embedding-3-small',
      });

      const vectorStore = await TypeORMVectorStore.fromExistingIndex(
        embeddings,
        {
          postgresConnectionOptions: AppDataSource,
          tableName: 'schema_embeddings',
        },
      );

      const retriever = vectorStore.asRetriever();
      const docs = await retriever.invoke(question);
      const context = docs.map((doc) => doc.pageContent).join('\n\n');

      const prompt = ChatPromptTemplate.fromTemplate(`
Eres un asistente experto en SQL que genera exclusivamente consultas PostgreSQL válidas para ser ejecutadas directamente.

⚠️ REGLAS ESTRICTAS:
- Usa solo **tablas y campos disponibles** en el contexto. NO inventes campos como "estado", "new_stage_id", etc.
- Si necesitas filtrar por nombre de etapa o estado, cruza con la tabla stage usando su campo "name".
- Si el nombre de una tabla es una palabra reservada (como "user"), colócala entre comillas dobles: "user".
- NO incluyas explicaciones ni comentarios.
- La salida debe ser **solo** una consulta SQL, comenzando con "SELECT", "INSERT", etc.
- NO utilices nombres como 'table_name', 'column_name' ni campos que no existan.
- NO consultes campos como "body" directamente en las tablas lead, pre_contact o oportunity. Esos campos están en las tablas de tipificación: typification_lead, typification_oportunity, typification_pre_contact.

🧩 CONTEXTO:
{context}

❓ CONSULTA:
{input}
`);

      const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
      });

      const chain = await createRetrievalChain({
        combineDocsChain: RunnableSequence.from([prompt, llm]),
        retriever,
      });

      const result = await chain.invoke({
        input: String(question),
        context,
      });

      generatedQuery = String(result.answer?.content ?? '')
        .replace(/```sql\n?/gi, '')
        .replace(/```/g, '')
        .trim();

      if (!/^select/i.test(generatedQuery.trim())) {
        return {
          query: generatedQuery,
          result: null,
          warning:
            'La consulta generada no parece válida (no inicia con SELECT)',
        };
      }

      const dataSource = new DataSource(CRMDataSource);
      if (!dataSource.isInitialized) await dataSource.initialize();

      const queryResult = await dataSource.query(generatedQuery);

      return {
        query: generatedQuery,
        result: queryResult,
      };
    } catch (error) {
      return {
        query: generatedQuery,
        result: null,
        error: error?.message || 'Error desconocido',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
