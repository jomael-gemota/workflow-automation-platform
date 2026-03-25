import { Schema, model, Document } from 'mongoose';

export interface ApiKeyDocument extends Document {
    keyId: string;
    key: string;
    name: string;
    createdAt: Date;
}

const ApiKeySchema = new Schema<ApiKeyDocument>(
    {
        keyId: { type: String, required: true, unique: true },
        key: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
    },
    { timestamps: true }
);

export const ApiKeyModel = model<ApiKeyDocument>('ApiKey', ApiKeySchema);