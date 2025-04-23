import { PartialType } from '@nestjs/swagger';
import { CreateLangGraphDto } from './create-lang-graph.dto';

export class UpdateLangGraphDto extends PartialType(CreateLangGraphDto) {}
