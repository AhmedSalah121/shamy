import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class CreateNotificationDto {
    @Field()
    sender: string;

    @Field()
    reciever: string;
}
