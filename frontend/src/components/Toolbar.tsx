import { Save, Play, Loader2, LogOut, PanelRight, KeyRound, Sun, Moon, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { useWorkflowStore } from '../store/workflowStore';
import { useTriggerWorkflow } from '../hooks/useWorkflows';
import { useSaveWorkflow } from '../hooks/useSaveWorkflow';
import { useState, useEffect, useRef } from 'react';
import { CredentialsModal } from './ui/CredentialsModal';
import { ConfirmModal } from './ui/ConfirmModal';

export function Toolbar() {
  const {
    activeWorkflow,
    setActiveWorkflow,
    nodes,
    isDirty,
    setDirty,
    setLogOpen,
    setLastExecutionId,
    beginExecution,
    configOpen,
    setConfigOpen,
    theme,
    setTheme,
  } = useWorkflowStore();

  const { save, isSaving } = useSaveWorkflow();
  const trigger = useTriggerWorkflow();
  const [nameEdit, setNameEdit] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false, title: '', message: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a stable ref so the keyboard listener never captures a stale closure
  const handleSaveRef = useRef<() => void>(() => {});

  function showAlert(title: string, message: string) {
    setAlertModal({ open: true, title, message });
  }

  async function handleSave() {
    if (!activeWorkflow) return;
    if (nodes.length === 0) {
      showAlert('Cannot save', 'Add at least one node to the canvas before saving.');
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    try {
      await save();
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('idle');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showAlert('Save failed', msg);
    }
  }

  // Always keep ref pointing at the latest handleSave
  handleSaveRef.current = handleSave;

  // Ctrl+S / Cmd+S shortcut — registered once, reads latest state via ref
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function handleTrigger() {
    if (!activeWorkflow || !activeWorkflow.id || activeWorkflow.id.startsWith('__new__')) return;
    try {
      const preStatuses: Record<string, import('../store/workflowStore').NodeExecutionStatus> = {};
      for (const n of nodes) {
        preStatuses[n.id] = 'waiting';
      }
      beginExecution(preStatuses);

      const summary = await trigger.mutateAsync({ workflowId: activeWorkflow.id });
      setLastExecutionId(summary.executionId);
      setLogOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showAlert('Trigger failed', msg);
    }
  }

  function handleLogout() {
    localStorage.removeItem('wap_api_key');
    window.location.reload();
  }

  const saving = isSaving;
  const triggering = trigger.isPending;
  const isNew = activeWorkflow?.id?.startsWith('__new__') ?? false;

  return (
    <>
    <ConfirmModal
      alertOnly
      open={alertModal.open}
      title={alertModal.title}
      message={alertModal.message}
      onConfirm={() => setAlertModal(a => ({ ...a, open: false }))}
      onCancel={() => setAlertModal(a => ({ ...a, open: false }))}
    />
    {/* ── Saving toast ── */}
    <div
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full shadow-xl text-xs font-semibold pointer-events-none select-none transition-all duration-300 ${
        saveStatus === 'idle'
          ? 'opacity-0 -translate-y-1.5 scale-95'
          : 'opacity-100 translate-y-0 scale-100'
      } ${
        saveStatus === 'saving'
          ? 'bg-slate-700 dark:bg-slate-600 text-white'
          : 'bg-emerald-500 dark:bg-emerald-500 text-white'
      }`}
    >
      {saveStatus === 'saving' ? (
        <><Loader2 className="w-3 h-3 animate-spin" /><span>Saving…</span></>
      ) : (
        <><Check className="w-3 h-3" /><span>Saved</span></>
      )}
    </div>

    <header className="h-12 glass-surface border-b border-black/[0.07] dark:border-white/10 flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Flux" className="w-6 h-6 rounded-md object-contain" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Flux</span>
      </div>

      <div className="w-px h-6 glass-divider" />

      {activeWorkflow ? (
        nameEdit ? (
          <input
            autoFocus
            className="bg-black/5 dark:bg-white/8 border border-black/10 dark:border-white/15 text-gray-900 dark:text-white text-sm rounded px-2 py-0.5 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={() => {
              if (nameValue.trim()) {
                setActiveWorkflow({ ...activeWorkflow, name: nameValue.trim() });
                setDirty(true);
              }
              setNameEdit(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setNameEdit(false);
            }}
          />
        ) : (
          <button
            className="text-gray-900 dark:text-white text-sm font-medium hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            onClick={() => { setNameValue(activeWorkflow.name); setNameEdit(true); }}
          >
            {activeWorkflow.name}
            {!isNew && (
              <span className="ml-1.5 text-slate-400 dark:text-slate-500 text-xs font-normal">
                v{activeWorkflow.version}
              </span>
            )}
            {isDirty && <span className="ml-1 text-amber-500 dark:text-amber-400 text-xs">●</span>}
          </button>
        )
      ) : (
        <span className="text-slate-400 dark:text-slate-500 text-sm">No workflow selected</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!activeWorkflow || !isDirty || saving}
          title="Save workflow structure (nodes, connections, positions). Use the Save button inside each node's config panel to save node settings."
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Workflow
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleTrigger}
          disabled={!activeWorkflow || isNew || triggering}
        >
          {triggering ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Trigger
        </Button>

        <div className="w-px h-5 glass-divider" />

        <button
          onClick={() => setCredentialsOpen(true)}
          title="Manage Google Workspace credentials"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Credentials
        </button>

        <div className="w-px h-5 glass-divider" />

        <button
          onClick={() => setConfigOpen(!configOpen)}
          title={configOpen ? 'Hide configuration panel' : 'Show configuration panel'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            configOpen
              ? 'bg-black/8 dark:bg-white/10 text-slate-700 dark:text-slate-200'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          <PanelRight className="w-3.5 h-3.5" />
          Config
        </button>

        <div className="w-px h-5 glass-divider" />

        {/* ── Theme toggle ─────────────────────────────────────────────── */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-7 h-7 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />
          }
        </button>

        <button
          onClick={handleLogout}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors p-1"
          title="Change API key"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <CredentialsModal open={credentialsOpen} onClose={() => setCredentialsOpen(false)} />
    </>
  );
}
