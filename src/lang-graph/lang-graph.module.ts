import { Module } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { LangGraphController } from './lang-graph.controller';

@Module({
  controllers: [LangGraphController],
  providers: [LangGraphService],
})
export class LangGraphModule {}
