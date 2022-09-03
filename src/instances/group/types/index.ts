import {
    Document,
    Model,
} from 'mongoose';

export interface IMongoose {
    telegramId: string;
}

export interface IObject extends IMongoose {
    _id: Document['_id'];

    createdAt: Date;
    updatedAt: Date;
}

export interface IDocument extends IObject, Document {
    _id: Document['_id'];
}

export interface IModel extends Model<IDocument> {
    findGroupWithMinimumUsers(): Promise<IObject | null>;
    createIfNotExists(telegramId: string): Promise<IObject | null>;
}
