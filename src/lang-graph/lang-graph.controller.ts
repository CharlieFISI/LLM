import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LangGraphService } from './lang-graph.service';
import { CreateLangGraphDto } from './dto/create-lang-graph.dto';
import { UpdateLangGraphDto } from './dto/update-lang-graph.dto';

@Controller('lang-graph')
export class LangGraphController {
  constructor(private readonly langGraphService: LangGraphService) {}

  @Post()
  create(@Body() createLangGraphDto: CreateLangGraphDto) {
    return this.langGraphService.create(createLangGraphDto);
  }

  @Get()
  findAll() {
    return this.langGraphService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.langGraphService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLangGraphDto: UpdateLangGraphDto) {
    return this.langGraphService.update(+id, updateLangGraphDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.langGraphService.remove(+id);
  }
}
