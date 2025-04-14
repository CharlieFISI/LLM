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

  @Column({ nullable: true })
  chatModel: string;

  @Column({ nullable: true })
  embeddingModel: string;

  @CreateDateColumn()
  createdAt: Date;
}
