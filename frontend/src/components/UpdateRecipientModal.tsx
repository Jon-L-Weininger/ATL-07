import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Snowflake,
  Truck,
  MapPin,
  Users,
  ShieldCheck,
  Building,
} from 'lucide-react';
import {
  SurplusPosting,
  Recipient,
  MatchBrief,
  fetchRecipients,
  updatePostingRecipient,
} from '../services/brokerApi';

interface UpdateRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  posting: SurplusPosting;
  currentRecipient: Recipient | null;
  backups: Recipient[];
  initialRecipientId?: number | null;
  onRecipientUpdated: (updatedBrief: MatchBrief, message?: string) => void;
}

export const UpdateRecipientModal: React.FC<UpdateRecipientModalProps> = ({
  isOpen,
  onClose,
  posting,
  currentRecipient,
  backups,
  initialRecipientId,
  onRecipientUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(
    initialRecipientId ?? currentRecipient?.recipient_id ?? null,
  );
  const [coordinatorNote, setCoordinatorNote] = useState('');
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentFeedback, setAgentFeedback] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
    details?: string[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedRecipientId(initialRecipientId ?? currentRecipient?.recipient_id ?? null);
      setAgentFeedback(null);
      setCoordinatorNote('');
      setSearchQuery('');

      const loadAll = async () => {
        setIsLoadingRecipients(true);
        try {
          const res = await fetchRecipients();
          setAllRecipients(res.recipients);
        } catch (err) {
          console.error('Failed to load recipients list:', err);
        } finally {
          setIsLoadingRecipients(false);
        }
      };
      loadAll();
    }
  }, [isOpen, currentRecipient]);

  // Combine pre-screened backups with all recipients, ensuring uniqueness
  const filteredRecipients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return allRecipients;
    }
    return allRecipients.filter((r) => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchArch = (r.archetype_label || '').toLowerCase().includes(q);
      const matchStreet = (r.street || '').toLowerCase().includes(q);
      const matchZip = (r.zip_code || '').includes(q);
      const matchNeigh = (r.tract?.neighborhood || '').toLowerCase().includes(q);
      return matchName || matchArch || matchStreet || matchZip || matchNeigh;
    });
  }, [allRecipients, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientId) return;

    setIsSubmitting(true);
    setAgentFeedback(null);

    try {
      const res = await updatePostingRecipient(
        posting.posting_id,
        selectedRecipientId,
        coordinatorNote.trim() || undefined,
      );

      if (!res.success) {
        setAgentFeedback({
          type: res.warning ? 'warning' : 'error',
          message: res.error || 'The primary agent rejected this assignment.',
          details: res.rejection_reasons,
        });
      } else if (res.brief) {
        onRecipientUpdated(res.brief, res.message);
        onClose();
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Error contacting primary agent to update recipient.';
      setAgentFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                  Update Recipient
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
                  Primary Agent Evaluation
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Call the primary food broker agent to re-validate cold chain, check capacity, and reassign Offer #{posting.posting_id}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offer Summary Bar */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              Offer #{posting.posting_id}:
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {posting.foodkeeper_product}
            </span>
            <span>·</span>
            <span className="text-slate-600 dark:text-slate-400">{posting.donor_name}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span className="capitalize flex items-center gap-1">
              <Snowflake className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {posting.storage_state}
            </span>
            <span>~{posting.pallets_estimated} pallets</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              {posting.hours_remaining}h left on clock
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Agent Feedback Alert Banner */}
          {agentFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs animate-shake ${
                agentFeedback.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : agentFeedback.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
                agentFeedback.type === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div className="space-y-1">
                <div className="font-semibold text-sm">
                  Primary Agent Safety Guardrail
                </div>
                <p className="leading-relaxed">{agentFeedback.message}</p>
                {agentFeedback.details && agentFeedback.details.length > 0 && (
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] opacity-90">
                    {agentFeedback.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Quick Select Pre-Screened Backups */}
          {backups.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Pre-Screened Viable Candidates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {backups.map((b) => {
                  const isSelected = selectedRecipientId === b.recipient_id;
                  return (
                    <button
                      type="button"
                      key={b.recipient_id}
                      onClick={() => {
                        setSelectedRecipientId(b.recipient_id);
                        setAgentFeedback(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-600'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-emerald-400 dark:hover:border-emerald-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {b.name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{b.tract?.neighborhood || b.city}</span>
                        <span className="font-mono capitalize font-medium text-emerald-700 dark:text-emerald-400">
                          {b.cold_storage} · {b.max_pallets} plt max
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Across All Atlanta Recipients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" />
                All Atlanta Community Organizations ({allRecipients.length})
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredRecipients.length} matches
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by organization name, street, ZIP, or Atlanta neighborhood..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Recipient Cards Directory */}
            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950/40">
              {isLoadingRecipients ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading Atlanta community organization corpus...
                </div>
              ) : filteredRecipients.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No organizations found matching &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredRecipients.map((rec) => {
                  const isSelected = selectedRecipientId === rec.recipient_id;
                  const isCurrent = currentRecipient?.recipient_id === rec.recipient_id;
                  const hasColdSafetyWarning =
                    posting.storage_state === 'refrigerated' &&
                    rec.cold_storage === 'none';

                  return (
                    <div
                      key={rec.recipient_id}
                      onClick={() => {
                        setSelectedRecipientId(rec.recipient_id);
                        setAgentFeedback(null);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-emerald-600'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {rec.name}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              Current Match
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {rec.archetype_label}
                          </span>
                          {hasColdSafetyWarning && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Ambient Only
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{rec.street}, {rec.city}</span>
                          <span>·</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {rec.tract?.neighborhood || 'Atlanta Metro'}
                          </span>
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 text-[11px]">
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rec.cold_storage} · max {rec.max_pallets} plt
                        </span>
                        {rec.tract?.no_vehicle_rate !== undefined && (
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            {(rec.tract.no_vehicle_rate * 100).toFixed(1)}% no-vehicle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Optional Coordinator Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Coordinator Dispatch Notes for Primary Agent (Optional)
            </label>
            <textarea
              value={coordinatorNote}
              onChange={(e) => setCoordinatorNote(e.target.value)}
              placeholder="e.g., Confirmed staff availability for dock intake by 5pm; prioritizing West End distribution corridor."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedRecipientId}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Calling Primary Agent...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  Confirm &amp; Update with Primary Agent
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
