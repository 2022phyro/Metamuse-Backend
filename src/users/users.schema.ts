import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';


export type UserDocument = HydratedDocument<User>;
@Schema()
export class User {
    
    @Prop({ required: true, minlength: 1, maxlength: 100 })
    firstName: string;
    @Prop({ required: true, minlength: 1, maxlength: 100 })
    lastName: string;
    @Prop({ required: true, minlength: 1, maxlength: 100, unique: true })
    email: string;
    @Prop({ required: true, minlength: 6})
    password: string;
    @Prop({ required: true, default: Date.now })
    createdAt: Date;
    @Prop({ required: true, default: Date.now })
    lastAuthChange: Date;

    @Prop({ default: "unverified"}) // unverified, active, banned, deactivated
    status: string;

    // @Prop({ type: [String], default: ["user"]}) // general, admin, artist
    // roles: string[];
}
export const UserSchema =
    SchemaFactory.createForClass(User);

