import { getDatabase } from "../db/database";
import { WorkflowDefinition } from "../types/workflow.types";

interface WorkflowRow {
    id: string;
    name: string;
    version: number;
    definition: string;
    created_at: string;
    updated_at: string;
}

export class WorkflowRepository {
    private db = getDatabase();

    save(workflow: WorkflowDefinition): void {
        const stmt = this.db.prepare(`
            INSERT INTO workflows (id, name, version, definition)
            VALUES (@id, @name, @version, @definition)
            ON CONFLICT(id) DO UPDATE SET
                name = @name,
                version = @version,
                definition = @definition,
                updated_at = datetime('now')
        `);

        stmt.run({
            id: workflow.id,
            name: workflow.name,
            version: workflow.version,
            definition: JSON.stringify(workflow),
        });
    }

    findById(id: string): WorkflowDefinition | null {
        const row = this.db
            .prepare('SELECT * FROM workflows WHERE id = ?')
            .get(id) as WorkflowRow | undefined;

        if (!row) return null;
        return JSON.parse(row.definition) as WorkflowDefinition;
    }

    findAll(): WorkflowDefinition[] {
        const rows = this.db
            .prepare('SELCT * FROM workflows ORDER BY created_at DESC')
            .all() as WorkflowRow[];

        return rows.map(row => JSON.parse(row.definition) as WorkflowDefinition);
    }

    delete(id: string): boolean {
        const result = this.db
            .prepare('DELETE FROM workflows WHEREid = ?')
            .run(id);
        
        return result.changes > 0;
    }
}