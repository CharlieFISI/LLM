import { Injectable } from '@nestjs/common';
import { CreateLangGraphDto } from './dto/create-lang-graph.dto';
import { UpdateLangGraphDto } from './dto/update-lang-graph.dto';

@Injectable()
export class LangGraphService {
  create(createLangGraphDto: CreateLangGraphDto) {
    return 'This action adds a new langGraph';
  }

  findAll() {
    return `This action returns all langGraph`;
  }

  findOne(id: number) {
    return `This action returns a #${id} langGraph`;
  }

  update(id: number, updateLangGraphDto: UpdateLangGraphDto) {
    return `This action updates a #${id} langGraph`;
  }

  remove(id: number) {
    return `This action removes a #${id} langGraph`;
  }
}
