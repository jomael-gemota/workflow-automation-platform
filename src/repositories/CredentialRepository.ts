import { CredentialModel, CredentialDocument } from '../db/models/CredentialModel';

export interface CredentialSummary {
    id: string;
    provider: 'google' | 'slack' | 'teams' | 'basecamp';
    label: string;
    email: string;
    scopes: string[];
    createdAt: Date;
}

export interface CredentialTokens {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    scopes?: string[];
}

export class CredentialRepository {

    async create(data: {
        provider: 'google' | 'slack' | 'teams' | 'basecamp';
        label: string;
        email: string;
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
        scopes: string[];
        userId?: string;
    }): Promise<CredentialDocument> {
        return CredentialModel.create(data);
    }

    async findAll(userId?: string): Promise<CredentialSummary[]> {
        const filter = userId ? { userId } : {};
        const docs = await CredentialModel.find(filter).sort({ createdAt: -1 });
        return docs.map(this.toSummary);
    }

    /** Used internally by auth services for upsert checks — filtered by userId when provided */
    async findAllForUpsert(userId?: string): Promise<CredentialSummary[]> {
        return this.findAll(userId);
    }

    async findById(id: string): Promise<CredentialDocument | null> {
        return CredentialModel.findById(id);
    }

    async updateTokens(id: string, tokens: CredentialTokens): Promise<void> {
        await CredentialModel.findByIdAndUpdate(id, {
            $set: {
                accessToken:  tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiryDate:   tokens.expiryDate,
                ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
            },
        });
    }

    async deleteById(id: string, userId?: string): Promise<boolean> {
        const filter: Record<string, unknown> = { _id: id };
        if (userId) filter.userId = userId;
        const result = await CredentialModel.findOneAndDelete(filter);
        return result !== null;
    }

    private toSummary(doc: CredentialDocument): CredentialSummary {
        return {
            id:        (doc._id as object).toString(),
            provider:  doc.provider,
            label:     doc.label,
            email:     doc.email,
            scopes:    doc.scopes,
            createdAt: (doc as unknown as { createdAt: Date }).createdAt,
        };
    }
}
