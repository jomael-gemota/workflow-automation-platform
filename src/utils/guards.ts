import { LLMConfig } from '../types/llm.types';
import { ConditionNodeConfig, SwitchNodeConfig } from '../types/condition.types';

export interface LLMNodeConfig extends LLMConfig {
  	userPrompt: string;
}

export function isLLMNodeConfig(config: unknown): config is LLMNodeConfig {
	if (typeof config !== 'object' || config === null) return false;

	const c = config as Record<string, unknown>;

	return (
		typeof c.provider === 'string' &&
		typeof c.model === 'string' &&
		typeof c.userPrompt === 'string'
	);
}

export function isConditionNodeConfig(config: unknown): config is ConditionNodeConfig {
	if (typeof config !== 'object' || config === null) return false;
	const c = config as Record<string, unknown>;
	return (
		typeof c.trueNext === 'string' &&
		typeof c.falseNext === 'string' &&
		typeof c.condition === 'object' &&
		c.condition !== null
	);
}

export function isSwitchNodeConfig(config: unknown): config is SwitchNodeConfig {
	if (typeof config !== 'object' || config === null) return false;
	const c = config as Record<string, unknown>;
	return (
		typeof c.defaultNext === 'string' &&
		Array.isArray(c.cases) &&
		c.cases.length > 0
	);
}