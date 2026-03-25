import cron, { ScheduledTask } from 'node-cron';
import { WorkflowRepository } from '../repositories/WorkflowRepository';
import { WorkflowService } from '../services/WorkflowService';

export class WorkflowScheduler {
    private tasks: Map<string, ScheduledTask> = new Map();

    constructor(
        private workflowRepo: WorkflowRepository,
        private workflowService: WorkflowService
    ) {}

    async start(): Promise<void> {
        const { data: workflows } = await this.workflowRepo.findAll(1000);

        for (const workflow of workflows) {
            if (workflow.schedule) {
                this.register(workflow.id, workflow.schedule);
            }
        }

        console.log(`[Scheduler] Started ${this.tasks.size} scheduled workflow(s)`);
    }

    register(workflowId: string, cronExpression: string): void {
        if (!cron.validate(cronExpression)) {
            console.warn(`[Scheduler] Invalid cron expression for workflow ${workflowId}: "${cronExpression}"`);
            return;
        }

        this.unregister(workflowId);

        const task = cron.schedule(cronExpression, async () => {
            try {
                await this.workflowService.trigger(workflowId, {}, 'manual');
                console.log(`[Scheduler] Triggered workflow ${workflowId}`);
            } catch (err) {
                console.error(`[Scheduler] Failed to trigger workflow ${workflowId}:`, err);
            }
        });

        this.tasks.set(workflowId, task);
    }

    unregister(workflowId: string): void {
        const existing = this.tasks.get(workflowId);
        if (existing) {
            existing.stop();
            this.tasks.delete(workflowId);
        }
    }

    stop(): void {
        for (const [, task] of this.tasks) {
            task.stop();
        }
        this.tasks.clear();
        console.log('[Scheduler] All scheduled tasks stopped');
    }
}
