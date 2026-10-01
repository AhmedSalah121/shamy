import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Entity()
export class Notification {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number;

    @Field()
    @Column()
    sender: string;

    @Field()
    @Column()
    reciever: string;

    @Field()
    @CreateDateColumn()
    created_at: Date;

    @Field({nullable: true})
    @Column({nullable: true})
    read_at: Date;

    constructor(sender: string, reciever: string) {
        this.sender = sender;
        this.reciever = reciever;
        this.created_at = new Date();
    }
}
