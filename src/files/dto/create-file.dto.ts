import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskCrmDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;
}