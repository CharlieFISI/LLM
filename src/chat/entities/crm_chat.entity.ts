import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class CrmChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  question: string;

  @Column({ nullable: true })
  sql: string;

  @Column({ type: 'jsonb', nullable: true })
  answer: string;

  @Column({ nullable: true })
  interpretation: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}