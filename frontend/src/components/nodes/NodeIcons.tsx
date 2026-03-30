/**
 * Shared node icon components used in the palette, canvas node headers, etc.
 */
import { Globe, Sparkles, GitBranch, Shuffle, Wand2, Flag, Zap, MessageSquare, Users } from 'lucide-react';
import type { NodeType } from '../../types/workflow';

// ── Brand SVGs ────────────────────────────────────────────────────────────────

export function GmailIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.548l8.073-6.055C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    </svg>
  );
}

export function GDriveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.1 66L29 25.7 51.9 66H6.1z" fill="#4285F4"/>
      <path d="M57.7 66L34.8 25.7l11.4-19.8L80 66H57.7z" fill="#FBBC05"/>
      <path d="M46.2 5.9L23.3 46.2H0L23 5.9h23.2z" fill="#34A853"/>
    </svg>
  );
}

export function GDocsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0H4a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6l-8-6z" fill="#4285F4"/>
      <path d="M14 0v6h6L14 0z" fill="#80ABFC"/>
      <rect x="6" y="11" width="12" height="1.5" rx=".75" fill="white" opacity=".9"/>
      <rect x="6" y="14" width="12" height="1.5" rx=".75" fill="white" opacity=".9"/>
      <rect x="6" y="17" width="8"  height="1.5" rx=".75" fill="white" opacity=".9"/>
    </svg>
  );
}

export function GSheetsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0H4a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6l-8-6z" fill="#34A853"/>
      <path d="M14 0v6h6L14 0z" fill="#7FD1A4"/>
      <path d="M6 10h5v2H6zm7 0h5v2h-5zM6 14h5v2H6zm7 0h5v2h-5zM6 18h5v2H6zm7 0h5v2h-5z" fill="white" opacity=".9"/>
    </svg>
  );
}

export function OpenAIIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M37.53 16.17a10.44 10.44 0 0 0-.9-8.58 10.57 10.57 0 0 0-11.36-5.07A10.44 10.44 0 0 0 17.4.88 10.57 10.57 0 0 0 7.33 8.17a10.44 10.44 0 0 0-6.95 5.07 10.57 10.57 0 0 0 1.3 12.34 10.44 10.44 0 0 0 .9 8.58 10.57 10.57 0 0 0 11.36 5.07 10.44 10.44 0 0 0 7.82 3.47 10.57 10.57 0 0 0 10.08-7.32 10.44 10.44 0 0 0 6.95-5.07 10.57 10.57 0 0 0-1.26-12.13z"
        fill="currentColor"/>
      <path d="M24.32 28.68l-3.97-6.87-3.97 6.87M16.38 12.32l3.97 6.87 3.97-6.87"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Unified NodeIcon component ────────────────────────────────────────────────

const NODE_HEADER_COLORS: Record<string, string> = {
  trigger:   'bg-purple-500',
  http:      'bg-sky-500',
  llm:       'bg-slate-700',
  condition: 'bg-amber-500',
  switch:    'bg-orange-500',
  transform: 'bg-cyan-500',
  output:    'bg-rose-500',
  gmail:     'bg-red-600',
  gdrive:    'bg-blue-500',
  gdocs:     'bg-blue-500',
  gsheets:   'bg-green-600',
  slack:     'bg-violet-600',
  teams:     'bg-blue-700',
};

export function nodeHeaderColor(type: string): string {
  return NODE_HEADER_COLORS[type] ?? 'bg-slate-500';
}

export function NodeIcon({ type, size = 13 }: { type: NodeType | string; size?: number }) {
  switch (type) {
    case 'trigger':   return <Zap       size={size} className="text-white" />;
    case 'http':      return <Globe     size={size} className="text-white" />;
    case 'llm':       return <OpenAIIcon size={size} />;
    case 'condition': return <GitBranch size={size} className="text-white" />;
    case 'switch':    return <Shuffle   size={size} className="text-white" />;
    case 'transform': return <Wand2     size={size} className="text-white" />;
    case 'output':    return <Flag      size={size} className="text-white" />;
    case 'gmail':     return <GmailIcon   size={size} />;
    case 'gdrive':    return <GDriveIcon  size={size} />;
    case 'gdocs':     return <GDocsIcon   size={size} />;
    case 'gsheets':   return <GSheetsIcon size={size} />;
    case 'slack':     return <MessageSquare size={size} className="text-white" />;
    case 'teams':     return <Users size={size} className="text-white" />;
    default:          return <Sparkles  size={size} className="text-white" />;
  }
}
