import { Schema, model, Document } from 'mongoose';

export interface CredentialDocument extends Document {
    provider: 'google' | 'slack' | 'teams' | 'basecamp';
    label: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiryDate: number;   // Unix ms timestamp (0 for non-expiring tokens like Slack)
    scopes: string[];
}

const CredentialSchema = new Schema<CredentialDocument>(
    {
        provider: { type: String, enum: ['google', 'slack', 'teams', 'basecamp'], required: true },
        label:    { type: String, required: true },
        email:    { type: String, required: true },
        accessToken:  { type: String, required: true },
        refreshToken: { type: String, required: true },
        expiryDate:   { type: Number, required: true },
        scopes: [{ type: String }],
    },
    { timestamps: true }
);

export const CredentialModel = model<CredentialDocument>('Credential', CredentialSchema);
