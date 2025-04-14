import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { OllamaEmbeddings } from '@langchain/ollama';
import { AppDataSource } from 'src/data-source';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { RunnableSequence } from '@langchain/core/runnables';
import { createRetrievalChain } from 'langchain/chains/retrieval';

@Injectable()
export class FilesService {
  private inputPath = join(__dirname, '..', '..', 'documents/input');
  private outputPath = join(__dirname, '..', '..', 'documents/output');

  constructor() {
    if (!existsSync(this.inputPath))
      mkdirSync(this.inputPath, { recursive: true });
    if (!existsSync(this.outputPath))
      mkdirSync(this.outputPath, { recursive: true });
  }

  async processFileOllamaAllMinilm(file: Express.Multer.File): Promise<{
    message: string;
    documents: number;
    chunks: number;
  }> {
    try {
      const originalPath = join(this.inputPath, file.filename);
      const ext = extname(file.originalname).toLowerCase();

      let loader;
      switch (ext) {
        case '.pdf':
          loader = new PDFLoader(originalPath);
          break;
        case '.txt':
          loader = new TextLoader(originalPath);
          break;
        default:
          throw new Error(`Tipo de archivo no soportado: ${ext}`);
      }

      const docs = await loader.load();

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 512,
        chunkOverlap: 50,
      });

      const splitDocs = await splitter.splitDocuments(docs);

      const embeddings = new OllamaEmbeddings({ model: 'all-minilm' });

      await TypeORMVectorStore.fromDocuments(splitDocs, embeddings, {
        postgresConnectionOptions: AppDataSource,
        tableName: 'document_ollama_allminilm',
      });

      return {
        message: 'Archivo procesado y almacenado exitosamente',
        documents: docs.length,
        chunks: splitDocs.length,
      };
    } catch (error) {
      console.error('❌ Error al procesar el archivo:', error);
      throw new Error('Hubo un error al procesar el archivo');
    }
  }

  async processFileOpenAI3Small(file: Express.Multer.File): Promise<{
    message: string;
    documents: number;
    chunks: number;
  }> {
    try {
      const originalPath = join(this.inputPath, file.filename);
      const ext = extname(file.originalname).toLowerCase();

      let loader;
      switch (ext) {
        case '.pdf':
          loader = new PDFLoader(originalPath);
          break;
        case '.txt':
          loader = new TextLoader(originalPath);
          break;
        default:
          throw new Error(`Tipo de archivo no soportado: ${ext}`);
      }

      const docs = await loader.load();

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 512,
        chunkOverlap: 50,
      });

      const splitDocs = await splitter.splitDocuments(docs);

      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'text-embedding-3-small',
      });

      await TypeORMVectorStore.fromDocuments(splitDocs, embeddings, {
        postgresConnectionOptions: AppDataSource,
        tableName: 'document_ollama_allminilm',
      });

      return {
        message: 'Archivo procesado y almacenado exitosamente',
        documents: docs.length,
        chunks: splitDocs.length,
      };
    } catch (error) {
      console.error('❌ Error al procesar el archivo:', error);
      throw new Error('Hubo un error al procesar el archivo');
    }
  }

  // async embedSchema(model: string) {
  //   const schemaPath = join(
  //     __dirname,
  //     '..',
  //     '..',
  //     'documents/input',
  //     'schema.embedding.txt',
  //   );
  //   const schemaContent = readFileSync(schemaPath, 'utf8');

  //   const splitter = new RecursiveCharacterTextSplitter({
  //     chunkSize: 512,
  //     chunkOverlap: 50,
  //   });

  //   const docs = await splitter.createDocuments([schemaContent]);

  //   const embeddings = new OllamaEmbeddings({ model: 'all-minilm' });

  //   await TypeORMVectorStore.fromDocuments(docs, embeddings, {
  //     postgresConnectionOptions: AppDataSource,
  //     tableName: 'schema_embeddings',
  //   });

  //   return 'Embedding del esquema realizado con éxito.';
  // }

  async questionCrmDb(question: string): Promise<any> {
    try {
      // Validar que la tabla de embeddings tenga data (opcional)
      // const count = await AppDataSource.getRepository('document_ollama_allminilm').count();
      // if (count === 0) throw new NotFoundException('No hay documentos procesados en la base.');

      // Cargar el vector store desde la base de datos
      const vectorStore = await TypeORMVectorStore.fromExistingIndex(
        new OllamaEmbeddings({ model: 'all-minilm' }),
        {
          postgresConnectionOptions: AppDataSource,
          tableName: 'document_ollama_allminilm',
        },
      );

      // Configurar el retriever para buscar en los documentos
      const retriever = vectorStore.asRetriever();

      // Crear el prompt con la estructura de la pregunta
      const prompt = ChatPromptTemplate.fromTemplate(`
        Eres un asistente útil que responde preguntas basado estrictamente en los documentos proporcionados.
  
        Contexto:
        {context}
  
        Pregunta:
        {input}
      `);

      // Instanciar el LLM
      const llm = new ChatOllama({ model: 'tinyllama:latest' });

      // Crear la cadena que conecta el retriever, el prompt y el modelo de lenguaje
      const chain = await createRetrievalChain({
        combineDocsChain: RunnableSequence.from([prompt, llm]),
        retriever,
      });

      // Instrucción fija para la pregunta
      const fixedInstruction =
        'Del archivo anterior, responde lo siguiente utilizando solo código SQL, sin explicaciones, sin comentarios y sin texto adicional: ';
      const fullQuestion = `${fixedInstruction} ${question}`;
      const response = await chain.invoke({ input: fullQuestion });

      // Procesar y devolver la respuesta
      const respuesta = String(
        response.answer?.content ?? 'No se encontró respuesta',
      );

      return { answer: respuesta };
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
}
