import { Injectable } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { OllamaEmbeddings } from '@langchain/ollama';
import { AppDataSource } from 'src/data-source';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';

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

  //   async processFile(
  //     file: Express.Multer.File,
  //     question: string,
  //   ): Promise<{
  //     message: string;
  //     documents: number;
  //     outputFile?: string;
  //     answer: string;
  //   }> {
  //     try {
  //       const originalPath = join(this.inputPath, file.filename);
  //       const ext = extname(file.originalname).toLowerCase();

  //       let loader;
  //       switch (ext) {
  //         case '.pdf':
  //           loader = new PDFLoader(originalPath);
  //           break;
  //         case '.txt':
  //           loader = new TextLoader(originalPath);
  //           break;
  //         default:
  //           throw new Error(`Tipo de archivo no soportado: ${ext}`);
  //       }

  //       const docs = await loader.load();

  //       const splitter = new RecursiveCharacterTextSplitter({
  //         chunkSize: 512,
  //         chunkOverlap: 50,
  //       });

  //       const splitDocs = await splitter.splitDocuments(docs);

  //       const embeddings = new OllamaEmbeddings({ model: 'all-minilm' });
  //       // const embeddings = new OpenAIEmbeddings({
  //       //   apiKey: process.env.OPENAI_API_KEY,
  //       //   model: 'text-embedding-3-small',
  //       // });

  //       const vectorStore = await TypeORMVectorStore.fromDocuments(
  //         splitDocs,
  //         embeddings,
  //         {
  //           postgresConnectionOptions: AppDataSource,
  //           tableName: 'document_openai_turbo_small',
  //         },
  //       );

  //       const retriever = vectorStore.asRetriever();

  //       const prompt = ChatPromptTemplate.fromTemplate(`
  // Eres un asistente útil que responde preguntas basado estrictamente en los documentos proporcionados.

  // Contexto:
  // {context}

  // Pregunta:
  // {input}
  // `);

  //       const llm = new ChatOllama({ model: 'gemma3:latest' });
  //       // const llm = new ChatOpenAI({
  //       //   apiKey: process.env.OPENAI_API_KEY,
  //       //   model: 'gpt-3.5-turbo',
  //       // });

  //       const chain = await createRetrievalChain({
  //         combineDocsChain: RunnableSequence.from([prompt, llm]),
  //         retriever,
  //       });

  //       const response = await chain.invoke({ input: question });

  //       const respuesta = String(
  //         response.answer?.content ?? 'No se encontró respuesta',
  //       );

  //       const textContent = docs.map((doc) => doc.pageContent).join('\n\n');
  //       const resultFileName = `resultado-${file.filename}.txt`;
  //       const resultFilePath = join(this.outputPath, resultFileName);

  //       const responseText = `
  // ---

  // ❓ Pregunta: ${question}

  // 💬 Respuesta: ${response.answer?.content ?? 'No se encontró respuesta'}
  // `;

  //       writeFileSync(resultFilePath, textContent + responseText);

  //       return {
  //         message: 'Archivo procesado y almacenado exitosamente',
  //         documents: docs.length,
  //         outputFile: resultFileName,
  //         answer: respuesta,
  //       };
  //     } catch (error) {
  //       console.error('❌ Error al procesar archivo:', error);
  //       throw new Error('Hubo un problema al procesar el archivo');
  //     }
  //   }
}
