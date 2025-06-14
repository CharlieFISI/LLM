import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
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

      // Paso 1: Obtener últimos mensajes como contexto (sin cambiar flujo)
      let previousChats1 = await this.crmChatRepository.find({
        where: { user_id },
        order: { created_at: 'DESC' },
        take: 5,
      });
      previousChats1 = previousChats1.reverse();

      const historySnippet = previousChats1
        .map(chat => `Usuario: ${chat.question}\nAsistente: ${chat.interpretation}`)
        .join('\n');

      // Paso 1: Clasificar intención del mensaje
      const classifyPrompt = ChatPromptTemplate.fromTemplate(`
        Clasifica el siguiente mensaje como:
        - "sql" si requiere una consulta a base de datos incluyendo preguntas sobre leads, precontactos, asesores, ganados, ventas.
        - "hello" si es un saludo o agradecimiento.
        - "bye" si es una despedida, incluso si es informal (ej: "nos vemos", "hasta luego", "cuídate").
        - "conversation" si es una conversación general.

        Responde solo con una de las palabras: "sql", "hello", "bye" o "conversation". No expliques tu respuesta.
        Si el mensaje es sobre **oportunidades** clasifícalo como "sql".
        Considera el historial reciente si el mensaje actual es una continuación.

        Historial reciente:
        ${historySnippet}

        Mensaje: {input}
      `);

      const llmClassifier = new ChatOllama({ model: 'llama3.1:8b' });
      const intentRaw = await llmClassifier.invoke(await classifyPrompt.format({ input: question }));
      const intent = intentRaw.content.toString().trim().toLowerCase();
      console.log('intent', intent);

      switch (intent) {
        case 'hello':
          // Registrar igual el mensaje como entrada casual
          const crm_chat_hello = this.crmChatRepository.create({
            user_id,
            question,
            interpretation: '¡Hola! 👋 Soy tu asistente de consultas para el CRM. \nPuedes hacerme preguntas como: \n- ¿Cuántas oportunidades hay?\n- Muestra los últimos 10 precontactos.\n¡Adelante, dime qué quieres saber! 😊',
          });
          await this.crmChatRepository.save(crm_chat_hello);

          return {
            answer: question,
            result: null,
            interpretation: crm_chat_hello.interpretation,
          };

        case 'bye':
          // Registrar igual el mensaje como entrada casual
          const crm_chat_bye = this.crmChatRepository.create({
            user_id,
            question,
            interpretation: '¡Hasta luego! 😊 Si necesitas algo más sobre el CRM, estaré aquí para ayudarte. ¡Que tengas un buen día!',
          });
          await this.crmChatRepository.save(crm_chat_bye);

          return {
            answer: question,
            result: null,
            interpretation: crm_chat_bye.interpretation,
          };

        case 'conversation':
          const vectorStoree = await TypeORMVectorStore.fromExistingIndex(
            new OllamaEmbeddings({ model: 'nomic-embed-text' }),
            {
              postgresConnectionOptions: AppDataSource,
              tableName: 'its_info_store',
            },
          );

          // Configurar el retriever para buscar en los documentos
          const retrieverr = vectorStoree.asRetriever();
          const contextDocss = await retrieverr.invoke(question);
          const contextTextt = contextDocss.map(doc => doc.pageContent).join('\n');

          // Crear el prompt con la estructura de la pregunta
          const promptt = ChatPromptTemplate.fromTemplate(`
            Eres un asistente conversacional experto. 
            Debes responder de manera natural y directa, utilizando como base el historial de conversación y los documentos proporcionados, sin mencionarlos explícitamente. 
            Si encuentras información relacionada en el contexto, complétala con tu conocimiento general para dar una respuesta más completa. 
            Si el tema no aparece en el contexto indica amablemente que no puedes responder y menciona los temas de los que sí dispones información. 
            Evita inventar datos.

            Historial reciente:
            {history}
      
            Contexto:
            {context}
      
            Pregunta:
            {input}
          `);

          // Instanciar el LLM
          const llmm = new ChatOllama({ model: 'llama3.1:8b' });

          const combineDocsChainn = await createStuffDocumentsChain({
            llm: llmm,
            prompt: promptt,
          });

          // Crear la cadena que conecta el retriever, el prompt y el modelo de lenguaje
          const chainn = await createRetrievalChain({
            combineDocsChain: combineDocsChainn,
            retriever: retrieverr,
          });

          // Instrucción fija para la pregunta
          const responsee = await chainn.invoke({
            input: question,
            history: historySnippet,
            context: contextTextt
          });

          // Registrar igual el mensaje como entrada casual
          const crm_chat_conversation = this.crmChatRepository.create({
            user_id,
            question,
            interpretation: responsee.answer,
          });
          await this.crmChatRepository.save(crm_chat_conversation);

          return {
            answer: question,
            result: null,
            interpretation: crm_chat_conversation.interpretation,
          };

        case 'sql':
          // Cargar el vector store desde la base de datos
          const vectorStore = await TypeORMVectorStore.fromExistingIndex(
            new OllamaEmbeddings({ model: 'nomic-embed-text' }),
            {
              postgresConnectionOptions: AppDataSource,
              tableName: 'document_ollama_allminilm_store',
            },
          );

          // Configurar el retriever para buscar en los documentos
          const retriever = vectorStore.asRetriever();
          const contextDocs = await retriever.invoke(question);

          // Guarda el registro
          const crm_chat_sql = this.crmChatRepository.create({
            user_id,
            question,
          });
          await this.crmChatRepository.save(crm_chat_sql);

          // Crear el prompt con la estructura de la pregunta
          const prompt = ChatPromptTemplate.fromTemplate(`
            Eres un experto en SQL. Dada la pregunta, debes crear una consulta SQL sintácticamente correcta, utilizando solo las columnas y tablas presentes en el contexto del esquema proporcionado. 
            Presta especial atención para **no** incluir columnas que no existan en el esquema y recuerda que no existe la tabla "opportunity" sino "oportunity".
            Debes utilizar **exclusivamente sintaxis compatible con PostgreSQL**, evitando funciones y operadores propios de otros motores como MySQL o SQL Server.
            Si la pregunta es ambigua (por ejemplo: "y el asesor Ysabel?"), utiliza el historial reciente para inferir el contexto completo.
            Si el nombre de una tabla coincide con una palabra reservada de SQL (como 'user'), debe ir **entre comillas dobles** ("user").
            Si se pregunta por países, la consulta debe hacerse con el nombre del país en español, ejemplo: México.
            Si se pregunta sobre algún nombre, por defecto búscalo sin distinguir mayúsculas o minúsculas y que permita coincidencias parciales (por ejemplo: ILIKE '%alexis%') a menos que se especifique lo contrario.
            Si se pregunta sobre productos ten en cuenta su tabla "product".
            Si se pregunta sobre cursos, considera que todos los productos corresponden a cursos y realiza la consulta directamente en la tabla "product" sin ningún filtro adicional salvo que se especifique explícitamente en la pregunta. Nunca utilices cláusulas WHERE relacionadas con cursos salvo que se indique claramente en la pregunta.
            Si se pregunta sobre dónde proviene un precontacto se refiere al campo "note" de la tabla "pre_contact" y busca sin distinguir mayúsculas.
            Si se pregunta por los productos de una oportunidad consulta la tabla 'oportunity_has_product'.
            Si se pregunta por los asesores significa buscar usuario con el rol de Asesor.
            Si se pregunta por el nombre de un usuario, lead o precontacto busca el campo 'fullname' de sus tablas correspondientes.
            Las consultas FROM user cámbialas a FROM "user".
            La tabla "user" no representa leads. Los leads están en la tabla "lead", y deben consultarse exclusivamente desde esa tabla. Nunca asumas que "user" contiene leads.
            Las oportunidades nuevas significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Nuevo'.
            Las oportunidades perdidas significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Perdido'.
            Las oportunidades ganadas o ventas significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Ganado'.
            Las oportunidades en seguimiento significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Seguimiento'.
            Las oportunidades por pagar significan filtrar oportunidades cuyo 'stage_id' corresponda al id de 'stage' donde 'name' = 'Pagará'.
            Un usuario no es un lead ni un precontacto.
            La tabla "opportunity" no existe. Cualquier consulta debe hacerse usando exclusivamente la tabla "oportunity" (con una sola "p"). Bajo ninguna circunstancia debe escribirse "opportunity".
            La tabla "opportunity_has_product" no existe. Cualquier consulta debe hacerse usando exclusivamente la tabla "oportunity_has_product" (con una sola "p"). Bajo ninguna circunstancia debe escribirse "opportunity_has_product".
            La tabla correcta es "user" no "users".
            Si quieres consultar los roles de un usuario busca en la tabla 'user_has_role'.
            No existe columna llamada owner_id.
            No existe columna llamada 'date' en la tabla 'oportunity'.
            Si se pregunta por la fecha actual utiliza funciones del sistema como NOW() o CURRENT_DATE. Bajo ningún concepto uses fechas fijas, predefinidas o inferidas a partir de información interna de tu modelo.
            Debes responder utilizando **solo** código SQL, sin envolverla en algún bloque de código, sin saltos de línea, sin caracteres especiales, sin explicaciones, sin comentarios, y sin texto adicional.

            Historial reciente:
            {history}
      
            Contexto:
            {context}
      
            Pregunta:
            {input}
          `);

          // Instanciar el LLM
          //const llm = new ChatOllama({ model: 'qwen3:8b' });
          const llm = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            model: 'gpt-4o-mini',
          });

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
          const response = await chain.invoke({
            input: question,
            history: historySnippet,
            context: contextDocs.map(doc => doc.pageContent).join('\n'),
          });

          // Obtener el contenido en texto plano
          let rawSql = String(
            response.answer ?? 'No se encontró respuesta',
          );
          console.log('rawSql', rawSql);

          // Si contiene ```sql al inicio y ``` al final
          if (rawSql.includes('```sql')) {
            rawSql = rawSql.replace('```sql', '').replace('```', '');
          }
          
          // Si la respuesta contiene una etiqueta </think>, tomar solo lo que viene después
          if (rawSql.includes('</think>')) {
            const endThinkTag = '</think>';
            const endThinkIndex = rawSql.indexOf(endThinkTag);
            //rawSql = rawSql.slice(endThinkIndex + endThinkTag.length).trim();

            // Texto después de </think>
            const afterThink = rawSql.slice(endThinkIndex + endThinkTag.length);

            // Buscar "select" desde allí
            const selectIndex = afterThink.toLowerCase().indexOf('select');
            if (selectIndex !== -1) {
              const afterSelect = afterThink.slice(selectIndex);

              // Buscar el punto y coma que cierra la consulta
              const semicolonIndex = afterSelect.indexOf(';');
              if (semicolonIndex !== -1) {
                rawSql = afterSelect.slice(0, semicolonIndex + 1).trim();
              } else {
                rawSql = afterSelect.trim(); // Por si no hay punto y coma
              }
            } else {
              rawSql = ''; // No se encontró "select"
            }
          }
          console.log('rawSql2', rawSql);

          crm_chat_sql.sql = rawSql;
          await this.crmChatRepository.save(crm_chat_sql);

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
            crm_chat_sql.interpretation = 'Lo siento, pero por razones de seguridad no puedo ejecutar consultas que modifiquen datos. \n¿En qué más puedo ayudarte?';
            await this.crmChatRepository.save(crm_chat_sql);
            return {
              answer: question,
              result: null,
              interpretation: crm_chat_sql.interpretation,
            };
          }

          // base de datos crm
          const dataSource = new DataSource(CRMDataSource);
          if (!dataSource.isInitialized) await dataSource.initialize();
          const queryResult = await dataSource.query(rawSql);
          crm_chat_sql.answer = queryResult;
          await this.crmChatRepository.save(crm_chat_sql);

          // Respuesta mejorada
          const resultPrompt = ChatPromptTemplate.fromTemplate(`
            Eres un experto en CRM y bases de datos que responde en español. Un usuario ha hecho la siguiente pregunta:
          
            {question}

            Se ejecutó la siguiente consulta SQL:

            {sql}
          
            Y se obtuvo el siguiente resultado:
          
            {result}
          
            Responde de manera clara, concisa, sin repetir la pregunta ni mencionar al usuario, enumerando los elementos de forma ordenada si es que el resultado es un array de varios objetos.
            No incluyas saludos, introducciones ni encabezados como "Respuesta".
            No incluyas la consulta SQL ni menciones nombres de tablas, columnas ni estructura técnica.
            Si se incluyen fechas en el resultado, muéstralas en el formato día/mes/año (por ejemplo, 23/08/2024).
            Si el resultado devuelve alguna contraseña, no la muestres.
          `);

          // Formateamos el prompt con la pregunta y resultado
          const interpretationPromptValue = await resultPrompt.format({
            question,
            sql: rawSql,
            result: JSON.stringify(queryResult),
          });

          // Pasamos eso al LLM
          const interpretationResponse = await llmClassifier.invoke(interpretationPromptValue);
          crm_chat_sql.interpretation = interpretationResponse.content.toString();
          await this.crmChatRepository.save(crm_chat_sql);

          // Retornar la respuesta final
          return { answer: rawSql, result: queryResult ?? 'sin respuesta', interpretation: interpretationResponse.content };

        default:
          // Registrar igual el mensaje como entrada casual
          const crm_chat = this.crmChatRepository.create({
            user_id,
            question,
            interpretation: 'Solo puedo ayudarte con preguntas sobre la base de datos o SAP',
          });
          await this.crmChatRepository.save(crm_chat);

          return {
            answer: question,
            result: null,
            interpretation: crm_chat.interpretation,
          };
      }
    } catch (error) {
      console.error('Error al preguntar sobre el CRM:', error.message);
      return {
        answer: 'question',
        result: null,
        interpretation: 'Ha ocurrido un error',
      };
      /*if (error instanceof HttpException) {
        console.error('Error al preguntar sobre el CRM:', error.message);
        throw error;
      } else {
        console.error('Error al preguntar sobre el CRM:', error);
        throw new InternalServerErrorException(
          `Error al preguntar sobre el CRM: ${error.message}`,
        );
      }*/
    }
  }

  async listCrmChatByUser(user_id: number, message_number: number): Promise<any> {
    try {
      const chats = await this.crmChatRepository.find({
        where: { user_id: +user_id },
        order: { created_at: 'DESC' },
        take: +message_number,
      });

      const total_messages = await this.crmChatRepository.count({
        where: { user_id: +user_id },
      });

      return { chats: chats.reverse(), total_messages: total_messages };
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
