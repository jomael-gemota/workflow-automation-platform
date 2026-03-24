export type ComparisonOperator =
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'isNull'
    | 'isNotNull';

export type LogicalOperator = 'and' | 'or' | 'not';

export interface LeafCondition {
    type: 'leaf';
    left: string;
    operator: ComparisonOperator;
    right?: unknown;
}

export interface GroupCondition {
    type: 'group';
    operator: LogicalOperator;
    conditions: Condition[];
}

export type Condition = LeafCondition | GroupCondition;

export interface ConditionNodeConfig {
    condition: Condition;
    trueNext: string;
    falseNext: string;
}

export interface SwitchCase {
    condition: Condition;
    next: string;
    label?: string;
}

export interface SwitchNodeConfig {
    cases: SwitchCase[];
    defaultNext: string;
}