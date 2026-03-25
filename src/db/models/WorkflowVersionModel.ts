import { Schema, model, Document } from 'mongoose';
import { WorkflowDefinition } from '../../types/workflow.types';

export interface WorkflowVersionDocument extends Document {
    workflowId: string;
    version: number;
    definition: WorkflowDefinition;
    archivedAt: Date;
}

const WorkflowVersionSchema = new Schema<WorkflowVersionDocument>({
    workflowId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    definition: { type: Schema.Types.Mixed, required: true },
    archivedAt: { type: Date, default: Date.now },
});

WorkflowVersionSchema.index({ workflowId: 1, version: -1 });

export const WorkflowVersionModel = model<WorkflowVersionDocument>(
    'WorkflowVersion',
    WorkflowVersionSchema
);