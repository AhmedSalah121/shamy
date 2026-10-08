import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sender: string;

    @Column()
    reciever: string;

    @CreateDateColumn()
    created_at: Date;

    @Column({ nullable: true })
    read_at: Date;

    constructor(sender?: string, reciever?: string) {
        if (sender) this.sender = sender;
        if (reciever) this.reciever = reciever;
        this.created_at = new Date();
    }
}
