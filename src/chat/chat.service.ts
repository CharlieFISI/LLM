import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { AppDataSource, CRMDataSource } from 'src/data-source';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { CrmChat } from './entities/crm_chat.entity';

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface TokenUsageMetadata {
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

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
    @InjectRepository(CrmChat)
    private readonly crmChatRepository: Repository<CrmChat>,
  ) { }

  async chatGPT(userMessage: string): Promise<{
    response: string;
    usage: TokenUsage;
  }> {
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
    });

    const messages = [
      new SystemMessage('Responde con claridad y brevedad.'),
      new HumanMessage(userMessage),
    ];

    const res = (await model.invoke(messages)) as {
      content: string | unknown[];
      response_metadata?: TokenUsageMetadata;
    };

    const content =
      typeof res.content === 'string'
        ? res.content
        : res.content
          .map((part) => (isTextPart(part) ? part.text : ''))
          .join('');

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
    const model = new ChatOllama({
      model: 'gemma3:latest',
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

  async questionCrmDb(data: any): Promise<any> {
    try {
      const { question, llm_model, user_id } = data;

      // Cargar el vector store desde la base de datos
      const vectorStore = await TypeORMVectorStore.fromExistingIndex(
        new OllamaEmbeddings({ model: 'nomic-embed-text' }),
        {
          postgresConnectionOptions: AppDataSource,
          tableName: 'document_ollama_allminilm',
        },
      );

      // Configurar el retriever para buscar en los documentos
      const retriever = vectorStore.asRetriever();

      // Guarda el registro
      const crm_chat = this.crmChatRepository.create({
        user_id,
        question,
      });
      await this.crmChatRepository.save(crm_chat);

      // Crear el prompt con la estructura de la pregunta
      const prompt = ChatPromptTemplate.fromTemplate(`
          Eres un experto en SQL. Dada la pregunta, debes crear una consulta SQL sintácticamente correcta, utilizando solo las columnas y tablas presentes en el contexto del esquema proporcionado. 
          Presta especial atención para **no** incluir columnas que no existan en el esquema y recuerda que no existe la tabla "opportunity" sino "oportunity".
          Debes utilizar **exclusivamente sintaxis compatible con PostgreSQL**, evitando funciones y operadores propios de otros motores como MySQL o SQL Server.
          Si la pregunta sugiere crear, actualizar o eliminar algún registro o tabla, responde con el mensaje 'No se pueden alterar datos'.
          Si el nombre de una tabla coincide con una palabra reservada de SQL (como 'user'), debe ir **entre comillas dobles** ("user").
          Si se pregunta por países, la consulta debe hacerse con el nombre del país en español, ejemplo: México.
          Si se pregunta sobre algún nombre, por defecto búscalo sin distinguir mayúsculas o minúsculas a menos que se especifique.
          Si se pregunta sobre productos ten en cuenta su tabla "product".
          Si se pregunta sobre cursos, considera que todos los productos corresponden a cursos y realiza la consulta directamente en la tabla "product" sin ningún filtro adicional salvo que se especifique explícitamente en la pregunta. Nunca utilices cláusulas WHERE relacionadas con cursos salvo que se indique claramente en la pregunta.
          Si se pregunta sobre dónde proviene un precontacto se refiere al campo "note" de la tabla "pre_contact" y busca sin distinguir mayúsculas.
          Las oportunidades nuevas significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Nuevo'.
          Las oportunidades perdidas significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Perdido'.
          Un usuario no es un lead ni un precontacto.
          La tabla correcta es "oportunity" no "opportunity".
          La tabla correcta es "user" no "users".
          Debes responder utilizando **solo** código SQL, sin envolverla en algún bloque de código, sin saltos de línea, sin caracteres especiales, sin explicaciones, sin comentarios, y sin texto adicional.
    
          Contexto:
          {context}
    
          Pregunta:
          {input}
        `);

      // Instanciar el LLM
      const llm = new ChatOllama({ model: 'qwen2.5-coder:7b' });
      /*const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4-turbo',
      });*/

      const combineDocsChain = await createStuffDocumentsChain({
        llm,
        prompt,
      });

      // Crear la cadena que conecta el retriever, el prompt y el modelo de lenguaje
      const chain = await createRetrievalChain({
        combineDocsChain,
        retriever,
      });

      // Instrucción fija para la pregunta
      const response = await chain.invoke({ input: question });

      // Obtener el contenido en texto plano
      let rawSql = String(
        response.answer ?? 'No se encontró respuesta',
      );
      console.log('rawSql', rawSql);
      // Si contiene ```sql al inicio y ``` al final
      if (rawSql.includes('```sql')) {
        rawSql = rawSql.replace('```sql', '').replace('```', '');
      }
      crm_chat.sql = rawSql;
      await this.crmChatRepository.save(crm_chat);

      // Validar si contiene comandos prohibidos
      const forbiddenWords = [
        'insert',
        'update',
        'delete',
        'drop',
        'alter',
        'truncate',
        'create',
        'rename',
        'comment',
        'grant',
        'revoke',
        'merge',
        'replace',
      ];
      const regex = new RegExp(`\\b(${forbiddenWords.join('|')})\\b`, 'i');
      if (regex.test(rawSql)) {
        throw new BadRequestException('Imposible alterar datos');
      }

      // base de datos crm
      const dataSource = new DataSource(CRMDataSource);
      if (!dataSource.isInitialized) await dataSource.initialize();
      const queryResult = await dataSource.query(rawSql);
      crm_chat.answer = queryResult;
      await this.crmChatRepository.save(crm_chat);

      // Respuesta mejorada
      const resultPrompt = ChatPromptTemplate.fromTemplate(`
          Eres un experto en CRM y bases de datos que responde en español. Un usuario ha hecho la siguiente pregunta:
        
          {question}
        
          Y se obtuvo el siguiente resultado:
        
          {result}
        
          Proporciona una respuesta breve y clara para el usuario de negocio.
          Si no se encontraron registros, responde: "No se encontraron registros que coincidan con la búsqueda."
        `);

      // Formateamos el prompt con la pregunta y resultado
      const interpretationPromptValue = await resultPrompt.format({
        question,
        result: JSON.stringify(queryResult),
      });

      // Pasamos eso al LLM
      const interpretationResponse = await llm.invoke(interpretationPromptValue);
      crm_chat.interpretation = interpretationResponse.content.toString();
      await this.crmChatRepository.save(crm_chat);

      // Retornar la respuesta final
      return { answer: rawSql, result: queryResult ?? 'sin respuesta', interpretation: interpretationResponse.content };
    } catch (error) {
      if (error instanceof HttpException) {
        console.error('Error al preguntar sobre el CRM:', error.message);
        throw error;
      } else {
        console.error('Error al preguntar sobre el CRM:', error);
        throw new InternalServerErrorException(
          `Error al preguntar sobre el CRM: ${error.message}`,
        );
      }
    }
  }

  async listCrmChatByUser(user_id: number, message_number: number): Promise<any> {
    try {
      const chats = await this.crmChatRepository.find({
        where: { user_id: +user_id },
        order: { created_at: 'DESC' },
        take: +message_number,
      });

      return chats;
    } catch (error) {
      if (error instanceof HttpException) {
        console.error('Error al listar el chat del CRM:', error.message);
        throw error;
      } else {
        console.error('Error al listar el chat del CRM:', error);
        throw new InternalServerErrorException(
          `Error al listar el chat del CRM: ${error.message}`,
        );
      }
    }
  }
}
