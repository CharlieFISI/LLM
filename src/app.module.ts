import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { Message } from './chat/entities/message.entity';
import { FilesModule } from './files/files.module';
import * as fs from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl:
        process.env.DATABASE_SSL === 'on'
          ? {
              rejectUnauthorized: false,
              ca: process.env.DB_SSL_CA_CERT
                ? fs.readFileSync(process.env.DB_SSL_CA_CERT).toString()
                : undefined,
              key: process.env.DB_SSL_KEY
                ? fs.readFileSync(process.env.DB_SSL_KEY).toString()
                : undefined,
              cert: process.env.DB_SSL_CERT
                ? fs.readFileSync(process.env.DB_SSL_CERT).toString()
                : undefined,
            }
          : false,
      entities: [Message],
      synchronize: true, // OJO: desactívalo en producción
    }),
    TypeOrmModule.forFeature([Message]),
    ChatModule,
    FilesModule,
  ],
})
export class AppModule {}
