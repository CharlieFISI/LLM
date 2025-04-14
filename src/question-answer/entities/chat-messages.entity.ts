import { IsOptional } from 'class-validator';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class ChatMessages {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  role: string;

  @Column()
  content: string;

  @Column()
  @IsOptional()
  chatModel: string;

  @Column()
  @IsOptional()
  embeddingModel: string;

  @CreateDateColumn()
  createdAt: Date;
}
