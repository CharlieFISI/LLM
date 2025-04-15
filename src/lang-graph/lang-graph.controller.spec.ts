import { Test, TestingModule } from '@nestjs/testing';
import { LangGraphController } from './lang-graph.controller';
import { LangGraphService } from './lang-graph.service';

describe('LangGraphController', () => {
  let controller: LangGraphController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LangGraphController],
      providers: [LangGraphService],
    }).compile();

    controller = module.get<LangGraphController>(LangGraphController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
