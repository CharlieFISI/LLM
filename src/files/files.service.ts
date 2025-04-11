import { Injectable } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { AppDataSource } from 'src/data-source';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Express } from 'express';

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

  async processFile(
    file: Express.Multer.File,
    question: string,
  ): Promise<{
    message: string;
    documents: number;
    outputFile?: string;
    answer: string;
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
      const cleanDocs = docs
        .filter(
          (doc) =>
            typeof doc.pageContent === 'string' &&
            doc.pageContent.trim().length > 0,
        )
        .map((doc) => ({
          ...doc,
          pageContent: doc.pageContent.trim(),
        }));

      const embeddings = new OllamaEmbeddings({ model: 'tinyllama:latest' });

      const vectorStore = await TypeORMVectorStore.fromDocuments(
        cleanDocs,
        embeddings,
        AppDataSource,
      );

      const retriever = vectorStore.asRetriever();

      const prompt = ChatPromptTemplate.fromTemplate(`
Eres un asistente útil que responde preguntas basado estrictamente en los documentos proporcionados.

Contexto:
{context}

Pregunta:
{input}
`);

      const llm = new ChatOllama({ model: 'tinyllama:latest' });

      const chain = await createRetrievalChain({
        combineDocsChain: RunnableSequence.from([prompt, llm]),
        retriever,
      });

      const response = await chain.invoke({ input: question });

      const respuesta = String(
        response.answer?.content ?? 'No se encontró respuesta',
      );

      const textContent = docs.map((doc) => doc.pageContent).join('\n\n');
      const resultFileName = `resultado-${file.filename}.txt`;
      const resultFilePath = join(this.outputPath, resultFileName);

      const responseText = `
---

❓ Pregunta: ${question}

💬 Respuesta: ${response.answer?.content ?? 'No se encontró respuesta'}
`;

      writeFileSync(resultFilePath, textContent + responseText);

      return {
        message: 'Archivo procesado y almacenado exitosamente',
        documents: docs.length,
        outputFile: resultFileName,
        answer: respuesta,
      };
    } catch (error) {
      console.error('❌ Error al procesar archivo:', error);
      throw new Error('Hubo un problema al procesar el archivo');
    }
  }
}
