import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { Message } from './chat/entities/message.entity';
import { FilesModule } from './files/files.module';
import { AppDataSource } from 'src/data-source';
import { QuestionAnswerModule } from './question-answer/question-answer.module';
import { LangGraphModule } from './lang-graph/lang-graph.module';
import { CrmChat } from './chat/entities/crm_chat.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      ...AppDataSource,
      entities: [Message, CrmChat],
      synchronize: true, // OJO: desactívalo en producción
    }),
    TypeOrmModule.forFeature([Message]),
    ChatModule,
    FilesModule,
    QuestionAnswerModule,
    LangGraphModule,
  ],
})
export class AppModule {}
