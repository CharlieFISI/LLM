import { Injectable } from '@nestjs/common';
import { join, extname, basename } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { OllamaEmbeddings } from '@langchain/ollama';
import { AppDataSource } from 'src/data-source';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';

@Injectable()
export class FilesService {
  private inputPath = join(__dirname, '..', '..', 'documents/input');
  private outputPath = join(__dirname, '..', '..', 'documents/output');

  constructor(
    //@InjectRepository(LLMmessage)
    //private readonly llmmessageRepository: Repository<LLMmessage>,
  ) {
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

      const embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text:latest' });

      await TypeORMVectorStore.fromDocuments(splitDocs, embeddings, {
        postgresConnectionOptions: AppDataSource,
        tableName: basename(file.originalname, ext) + '_store',
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

  async embedSchema(file: Express.Multer.File, model: string) {
    const originalPath = join(this.inputPath, file.filename);
    const loader = new TextLoader(originalPath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });

    const splitDocs = await splitter.splitDocuments(docs);
    const isOllama =
      !model.startsWith('text-embedding') && !model.startsWith('openai');

    const embeddings = isOllama
      ? new OllamaEmbeddings({ model })
      : new OpenAIEmbeddings({
          apiKey: process.env.OPENAI_API_KEY,
          model,
        });

    await TypeORMVectorStore.fromDocuments(splitDocs, embeddings, {
      postgresConnectionOptions: AppDataSource,
      tableName: 'schema_embeddings',
    });

    return 'Embedding del esquema realizado con éxito.';
  }
}
