import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskCrmDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  llm: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  user_id: number;
}