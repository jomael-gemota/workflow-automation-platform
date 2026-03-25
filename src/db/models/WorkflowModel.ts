import { Schema, model, Document } from 'mongoose';
import { WorkflowDefinition } from '../../types/workflow.types';

export interface WorkflowDocument extends Document {
    workflowId: string;
    name: string;
    version: number;
    definition: WorkflowDefinition;
    webhookSecret: string;
    createdAt: Date;
    updatedAt: Date;
}

const WorkflowSchema = new Schema<WorkflowDocument>(
    {
        workflowId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        version: { type: Number, required: true, default: 1 },
        definition: { type: Schema.Types.Mixed, required: true },
        webhookSecret: { type: String, required: true },
    },
    {
        timestamps: true,
    }
);

export const WorkflowModel = model<WorkflowDocument>('Workflow', WorkflowSchema);