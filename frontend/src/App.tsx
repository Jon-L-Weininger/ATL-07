import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  CheckCircle2,
  Truck,
  Snowflake,
  Package,
  MapPin,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Plus,
  Sun,
  Moon,
  ArrowRight,
  RotateCcw,
  HeartHandshake,
  X,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import {
  SurplusPosting,
  MatchBrief,
  EquityAuditResponse,
  fetchPostings,
  fetchMatchBrief,
  fetchEquityAudit,
  createPosting,
  resetPostingRecipient,
  submitFulfilment,
} from './services/brokerApi';
import { ChatPanel } from './components/ChatPanel';
import { EquityAuditChart } from './components/EquityAuditChart';
import { UpdateRecipientModal } from './components/UpdateRecipientModal';

const RETAIL_TRACK = 'RETAIL';

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'broker' | 'equity'>('broker');
  const [postings, setPostings] = useState<SurplusPosting[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<number>(1);
  const [excludedByPosting, setExcludedByPosting] = useState<Record<number, number[]>>({});
  const [matchBrief, setMatchBrief] = useState<MatchBrief | null>(null);
  const [equityAudit, setEquityAudit] = useState<EquityAuditResponse | null>(null);

  const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);
  const [isFulfilling, setIsFulfilling] = useState<boolean>(false);
  const [copiedOutreach, setCopiedOutreach] = useState<boolean>(false);

  // Progressive disclosure toggles inside Match Brief
  const [showBackups, setShowBackups] = useState<boolean>(false);
  const [showDecoys, setShowDecoys] = useState<boolean>(false);

  // Slide-over AI Assistant Drawer (closed by default so workspace is uncluttered)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatExternalPrompt, setChatExternalPrompt] = useState<string | null>(null);

  // Update Recipient Modal state & banner notification
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  // New Surplus Offer Modal state (Retail & Grocer Rescue only)
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isSubmittingPosting, setIsSubmittingPosting] = useState<boolean>(false);
  const [newForm, setNewForm] = useState({
    donor_name: 'Ponce City Grocer & Fresh Market',
    foodkeeper_product: 'Spinach',
    storage_state: 'refrigerated',
    pallets_estimated: 1.5,
    hours_available: 6,
    posting_text:
      '15 cases (~1.5 pallets) of triple-washed bagged organic spinach and spring greens at 38°F. Must clear backroom dock within 6 hours.',
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Initial load of Retail postings and equity audit
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [postingsRes, auditRes] = await Promise.all([
          fetchPostings(RETAIL_TRACK),
          fetchEquityAudit(RETAIL_TRACK),
        ]);
        setPostings(postingsRes.postings);
        setEquityAudit(auditRes);
        if (
          postingsRes.postings.length > 0 &&
          !postingsRes.postings.some((p) => p.posting_id === selectedPostingId)
        ) {
          setSelectedPostingId(postingsRes.postings[0].posting_id);
        }
      } catch (err) {
        console.error('Error loading initial broker data:', err);
      }
    };
    loadInitial();
  }, []);

  // Load Match Brief whenever selectedPostingId or excluded recipients change
  useEffect(() => {
    const loadBrief = async () => {
      if (!selectedPostingId) return;
      setIsLoadingBrief(true);
      try {
        const excluded = excludedByPosting[selectedPostingId] || [];
        const brief = await fetchMatchBrief(selectedPostingId, excluded);
        setMatchBrief(brief);
      } catch (err) {
        console.error('Error loading match brief:', err);
      } finally {
        setIsLoadingBrief(false);
      }
    };
    loadBrief();
  }, [selectedPostingId, excludedByPosting]);

  const handleTheySaidNo = async () => {
    if (!matchBrief?.primary_match) return;
    setIsDeclining(true);
    const currentId = matchBrief.primary_match.recipient_id;
    const prevExcluded = excludedByPosting[selectedPostingId] || [];
    const nextExcluded = [...prevExcluded, currentId];
    setExcludedByPosting((prev) => ({
      ...prev,
      [selectedPostingId]: nextExcluded,
    }));
    setTimeout(() => setIsDeclining(false), 250);
  };

  const handlePromoteBackup = (targetRecipientId: number) => {
    if (!matchBrief?.primary_match) return;
    const prevExcluded = excludedByPosting[selectedPostingId] || [];
    const toExcludeIds = [matchBrief.primary_match.recipient_id];
    for (const b of matchBrief.backups) {
      if (b.recipient_id === targetRecipientId) break;
      toExcludeIds.push(b.recipient_id);
    }
    setExcludedByPosting((prev) => ({
      ...prev,
      [selectedPostingId]: Array.from(new Set([...prevExcluded, ...toExcludeIds])),
    }));
  };

  const handleResetExclusions = () => {
    setExcludedByPosting((prev) => ({
      ...prev,
      [selectedPostingId]: [],
    }));
  };

  const handleResetManualAssignment = async () => {
    try {
      const res = await resetPostingRecipient(selectedPostingId);
      if (res.success && res.brief) {
        setMatchBrief(res.brief);
        setAssignmentMessage('Reset recipient to algorithmic recommendation.');
        setTimeout(() => setAssignmentMessage(null), 3500);
      }
    } catch (err) {
      console.error('Failed to reset recipient assignment:', err);
    }
  };

  const handleToggleFulfilment = async (
    fulfill: boolean,
    targetRecipientId?: number,
    targetProductId?: number | string | null,
  ) => {
    if (!matchBrief) return;
    const recId = targetRecipientId ?? matchBrief.primary_match?.recipient_id;
    if (!recId) return;

    setIsFulfilling(true);
    try {
      const prodId =
        targetProductId !== undefined
          ? targetProductId
          : matchBrief.clock?.matched_product_id;

      const res = await submitFulfilment(
        selectedPostingId,
        recId,
        prodId,
        fulfill,
      );

      // Update match brief with new fulfilment details
      setMatchBrief(res.brief);

      // Update postings list
      setPostings((prev) =>
        prev.map((p) =>
          p.posting_id === selectedPostingId ? { ...p, ...res.posting } : p
        )
      );
    } catch (err) {
      console.error('Failed to update fulfilment:', err);
    } finally {
      setIsFulfilling(false);
    }
  };


  const handleCopyOutreach = () => {
    if (!matchBrief?.outreach_draft) return;
    navigator.clipboard.writeText(matchBrief.outreach_draft);
    setCopiedOutreach(true);
    setTimeout(() => setCopiedOutreach(false), 2000);
  };

  const handleAskInChat = (promptText: string) => {
    setIsChatOpen(true);
    setChatExternalPrompt(promptText);
  };

  const handleCreatePosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPosting(true);
    try {
      const res = await createPosting({
        ...newForm,
        track: RETAIL_TRACK,
      });
      const updated = await fetchPostings(RETAIL_TRACK);
      setPostings(updated.postings);
      setSelectedPostingId(res.posting.posting_id);
      setMatchBrief(res.initial_brief);
      setIsNewModalOpen(false);
    } catch (err) {
      console.error('Failed to create posting:', err);
    } finally {
      setIsSubmittingPosting(false);
    }
  };

  const activePosting =
    postings.find((p) => p.posting_id === selectedPostingId) || postings[0];

  // Compact shift pulse metrics
  const urgentCount = postings.filter((p) => p.hours_remaining <= 8).length;
  const totalPallets = postings.reduce((acc, p) => acc + (p.pallets_estimated || 1.5), 0);
  const matchedNoVehiclePct = equityAudit
    ? (equityAudit.matched_averages.no_vehicle_rate * 100).toFixed(1)
    : '27.4';
  const decoysCaughtCount = matchBrief?.rejected_decoys?.length || 2;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      {/* Top Coordinator Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 dark:bg-stone-950/95 backdrop-blur border-b border-stone-200/90 dark:border-stone-800 px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-900 dark:bg-emerald-800 text-stone-50 flex items-center justify-center shadow-sm">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-display font-bold tracking-tight text-stone-900 dark:text-stone-50">
                  Atlanta Food Rescue Dispatch
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-900/10 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300">
                  Metro Coordinator Desk
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Real-time perishable matching &amp; cold-chain verification
              </p>
            </div>
          </div>

          {/* Center View Switcher (2 clean tabs) */}
          <div className="flex items-center bg-stone-200/70 dark:bg-stone-900 p-1 rounded-xl border border-stone-300/60 dark:border-stone-800">
            <button
              onClick={() => setActiveTab('broker')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'broker'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Live Dispatch Queue
            </button>
            <button
              onClick={() => setActiveTab('equity')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'equity'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Neighborhood Equity
            </button>
          </div>

          {/* Right Controls: New Offer, AI Assistant Drawer, Dark Mode */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-900 hover:bg-emerald-950 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Surplus Offer
            </button>

            <button
              onClick={() => setIsChatOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:border-emerald-700 dark:hover:border-emerald-500 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              Ask Assistant
            </button>

            <button
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Toggle dark mode"
              className="p-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* Compact Operational Pulse Strip */}
        <section className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl px-5 py-3 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-stone-500 dark:text-stone-400">Urgent (&le;8h):</span>
              <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                {urgentCount} of {postings.length} offers
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-stone-200 dark:bg-stone-800" />

            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
              <span className="text-stone-500 dark:text-stone-400">Ready to Move:</span>
              <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                {totalPallets.toFixed(1)} pallets
              </span>
            </div>

            <div className="hidden md:block h-4 w-px bg-stone-200 dark:bg-stone-800" />

            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-stone-500 dark:text-stone-400">Safety Guardrail:</span>
              <span className="font-mono font-semibold text-amber-800 dark:text-amber-300">
                {decoysCaughtCount} unsafe decoys blocked
              </span>
            </div>

            <div className="hidden lg:block h-4 w-px bg-stone-200 dark:bg-stone-800" />

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
              <span className="text-stone-500 dark:text-stone-400">Transit-Dependent Reach:</span>
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                {matchedNoVehiclePct}% no-vehicle tracts
              </span>
              <span className="text-[11px] text-stone-400">(vs. 13% ATL avg)</span>
            </div>
          </div>
        </section>

        {/* Tab 1: Calm 2-Column Coordinator Dispatch View */}
        {activeTab === 'broker' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Incoming Rescue Queue (4 cols) */}
            <div className="xl:col-span-4 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-[#F6F3EE]/60 dark:bg-stone-900">
                <div>
                  <h2 className="text-base font-display font-semibold text-stone-900 dark:text-stone-100">
                    Incoming Rescue Queue
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Select an offer to review its recommended recipient
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  {postings.length} active
                </span>
              </div>

              <div className="divide-y divide-stone-200/70 dark:divide-stone-800/80">
                {postings.map((post) => {
                  const isSelected = post.posting_id === selectedPostingId;
                  const isCritical = post.hours_remaining <= 6;
                  const clockPct = Math.min(100, Math.max(14, (post.hours_remaining / 24) * 100));

                  return (
                    <button
                      key={post.posting_id}
                      onClick={() => setSelectedPostingId(post.posting_id)}
                      className={`w-full text-left p-4 transition-all ${
                        isSelected
                          ? 'bg-[#F3EFEA] dark:bg-emerald-950/25 border-l-4 border-l-emerald-800 dark:border-l-emerald-500'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-stone-400 dark:text-stone-500">
                              #{post.posting_id}
                            </span>
                            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                              {post.foodkeeper_product}
                            </h3>
                          </div>
                          <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[230px] mt-0.5">
                            {post.donor_name}
                          </p>
                        </div>

                        {post.fulfilment_status === 'fulfilled' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1 shrink-0 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Fulfilled
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1 shrink-0 ${
                              isCritical
                                ? 'bg-red-50 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {post.hours_remaining}h left
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed my-2.5 pl-1 border-l-2 border-stone-300 dark:border-stone-700">
                          {post.posting_text}
                        </p>
                      )}

                      {/* Subtle Urgency Bar */}
                      <div className="w-full h-1 bg-stone-200/80 dark:bg-stone-800 rounded-full overflow-hidden my-2.5">
                        <div
                          className={`h-full rounded-full transition-all ${
                            post.fulfilment_status === 'fulfilled'
                              ? 'bg-emerald-600'
                              : isCritical
                              ? 'bg-red-600'
                              : post.hours_remaining <= 10
                              ? 'bg-amber-500'
                              : 'bg-emerald-700'
                          }`}
                          style={{ width: `${post.fulfilment_status === 'fulfilled' ? 100 : clockPct}%` }}
                        />
                      </div>
                      {post.fulfilment_status === 'fulfilled' && post.fulfilled_recipient_name && (
                        <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mb-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Dispatched to {post.fulfilled_recipient_name}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-mono">
                        <span className="flex items-center gap-1 capitalize">
                          <Snowflake className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          {post.storage_state}
                        </span>
                        <span>~{post.pallets_estimated} pallets</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Focused Match Brief Card (8 cols) */}
            <div className="xl:col-span-8 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-sm overflow-hidden">
              {isLoadingBrief || !matchBrief ? (
                <div className="py-24 text-center text-sm text-stone-500">
                  Evaluating recipient capacity &amp; cold-chain constraints...
                </div>
              ) : matchBrief.status !== 'matched' || !matchBrief.primary_match ? (
                <div className="p-8 space-y-4">
                  <div className="p-6 rounded-2xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-display font-semibold text-base">
                      <AlertTriangle className="w-5 h-5" />
                      No Safe Recipient Available for This Load
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                      {matchBrief.refusal_explanation}
                    </p>
                    <button
                      onClick={handleResetExclusions}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:bg-stone-100"
                    >
                      Reset Declined Recipients
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Active Load Context Strip */}
                  <div className="px-6 py-3 bg-[#F6F3EE] dark:bg-stone-950/60 border-b border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                        Offer #{matchBrief.posting.posting_id}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-stone-800 dark:text-stone-200">
                        {matchBrief.posting.foodkeeper_product}
                      </span>
                      <span>·</span>
                      <span>{matchBrief.posting.donor_name}</span>
                    </div>
                    <div className="font-mono text-xs text-stone-500 dark:text-stone-400">
                      Requires {matchBrief.posting.storage_state} storage · ~
                      {matchBrief.posting.pallets_estimated} pallets
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Hero Recommended Recipient Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-stone-200/80 dark:border-stone-800">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {matchBrief.is_manual_assignment ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Assigned by Coordinator &amp; Verified by Agent
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Recommended Match
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                            {matchBrief.primary_match.archetype_label}
                          </span>
                        </div>

                        <h2 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-50">
                          {matchBrief.primary_match.name}
                        </h2>

                        <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0" />
                          <span>
                            {matchBrief.primary_match.street}, {matchBrief.primary_match.city},{' '}
                            {matchBrief.primary_match.state} {matchBrief.primary_match.zip_code}
                          </span>
                          <span>·</span>
                          <span className="font-medium text-stone-800 dark:text-stone-200">
                            {matchBrief.primary_match.tract.neighborhood}
                          </span>
                        </p>
                      </div>

                      {/* Primary Coordinator Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Confirm & Dispatch / Fulfilled toggle */}
                        {matchBrief.fulfilment?.is_fulfilled ? (
                          <button
                            onClick={() => handleToggleFulfilment(false)}
                            disabled={isFulfilling}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Click to reopen"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            ✓ Fulfilled → {matchBrief.fulfilment.recipient_name || 'Dispatched'} (Reopen)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleFulfilment(true)}
                            disabled={isFulfilling || !matchBrief.primary_match}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                            Confirm &amp; Dispatch
                          </button>
                        )}

                        {/* Prominent Update Recipient Button calling Primary Agent */}
                        <button
                          onClick={() => setIsUpdateModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-900 hover:bg-emerald-950 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02]"
                          title="Choose or change the recipient for this surplus posting using the primary agent"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                          Update Recipient
                        </button>

                        {matchBrief.is_manual_assignment && (
                          <button
                            onClick={handleResetManualAssignment}
                            title="Reset to default algorithmic recommendation"
                            className="px-3 py-2 rounded-xl text-xs font-medium border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to Recommended
                          </button>
                        )}

                        {(excludedByPosting[selectedPostingId]?.length || 0) > 0 && (
                          <button
                            onClick={handleResetExclusions}
                            title="Reset declined recipients"
                            className="px-3 py-2 rounded-xl text-xs font-medium border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset ({excludedByPosting[selectedPostingId]?.length})
                          </button>
                        )}
                        <button
                          onClick={handleTheySaidNo}
                          disabled={isDeclining}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300/80 dark:border-stone-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                          They Said No — Next Option
                        </button>
                      </div>
                    </div>

                    {/* Recipient Assignment Notification Banner */}
                    {assignmentMessage && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{assignmentMessage}</span>
                      </div>
                    )}
                    {matchBrief.is_manual_assignment && matchBrief.coordinator_note && !assignmentMessage && (
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <span className="font-semibold shrink-0">Coordinator Note:</span>
                        <span>{matchBrief.coordinator_note}</span>
                      </div>
                    )}

                    {/* 3 Clean Verification Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Tile 1: Clock & Pickup */}
                      <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          Dispatch Clock
                        </div>
                        <div className="text-lg font-mono font-bold text-stone-900 dark:text-stone-100">
                          {matchBrief.clock.hours_remaining}h window
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          Pickup within {matchBrief.primary_match.pickup_window_hours}h leaves{' '}
                          <span className="font-mono font-semibold text-emerald-800 dark:text-emerald-400">
                            +{matchBrief.clock.estimated_margin_hours}h buffer
                          </span>
                        </p>
                      </div>

                      {/* Tile 2: Storage & Capacity */}
                      <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
                          Capacity &amp; Cold Chain
                        </div>
                        <div className="text-lg font-mono font-bold text-stone-900 dark:text-stone-100 capitalize">
                          {matchBrief.capacity_check?.cold_storage} · {matchBrief.capacity_check?.max_pallets} plt max
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {matchBrief.capacity_check?.refrigerated_transport
                            ? 'On-site refrigerated van ready'
                            : 'Verified loading dock intake'}
                        </p>
                      </div>

                      {/* Tile 3: Community Impact */}
                      <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Community Reach
                        </div>
                        <div className="text-lg font-mono font-bold text-emerald-800 dark:text-emerald-400">
                          {(matchBrief.primary_match.tract.no_vehicle_rate * 100).toFixed(1)}% no-vehicle
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {matchBrief.capacity_check?.weekly_households} households/wk ·{' '}
                          {(matchBrief.primary_match.tract.poverty_rate * 100).toFixed(1)}% poverty
                        </p>
                      </div>
                    </div>

                    {/* Concise Why This Match */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Why This Recipient Was Chosen
                      </h3>
                      <ul className="space-y-2 text-xs text-stone-700 dark:text-stone-300">
                        {matchBrief.why_them?.slice(0, 2).map((reason, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 bg-[#FAF8F5] dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/70 dark:border-stone-800"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Ready-to-Send Coordinator Outreach Note */}
                    <div className="p-4 rounded-2xl bg-emerald-950/[0.03] dark:bg-emerald-950/20 border border-emerald-800/20 dark:border-emerald-800/50 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                          Ready-to-Send Dispatch Note
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() =>
                              handleAskInChat('Write the outreach message for this match')
                            }
                            className="text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:underline"
                          >
                            Customize in Assistant
                          </button>
                          <button
                            onClick={handleCopyOutreach}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-900 hover:bg-emerald-950 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            {copiedOutreach ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied to Clipboard
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Dispatch Message
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-900 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-800 leading-relaxed">
                        {matchBrief.outreach_draft}
                      </p>
                    </div>

                    {/* Progressive Disclosure Accordions: Backups & Blocked Decoys */}
                    <div className="space-y-3 pt-1">
                      {/* Accordion 1: Backups */}
                      <div className="border border-stone-200/90 dark:border-stone-800 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowBackups((prev) => !prev)}
                          className="w-full px-4 py-3 bg-[#FAF8F5] dark:bg-stone-800/50 hover:bg-stone-100/80 dark:hover:bg-stone-800 flex items-center justify-between text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                              Backup Options if Primary Declines
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-stone-200/80 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                              {matchBrief.backups.length} verified
                            </span>
                          </div>
                          {showBackups ? (
                            <ChevronUp className="w-4 h-4 text-stone-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-stone-500" />
                          )}
                        </button>

                        {showBackups && (
                          <div className="p-4 bg-white dark:bg-stone-900 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-stone-200/80 dark:border-stone-800">
                            {matchBrief.backups.map((b, idx) => (
                              <div
                                key={b.recipient_id}
                                className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                                      #{idx + 2} · {b.name}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                    {b.street} · {b.tract.neighborhood}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between text-[11px]">
                                  <span className="font-mono text-stone-600 dark:text-stone-400">
                                    {b.cold_storage} · max {b.max_pallets} plt
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleToggleFulfilment(true, b.recipient_id)}
                                      disabled={isFulfilling}
                                      className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline disabled:opacity-50"
                                      title="Lock dispatch and record fulfilment directly to this partner"
                                    >
                                      Select &amp; Fulfill &rarr;
                                    </button>
                                    <span className="text-stone-300 dark:text-stone-700">|</span>
                                    <button
                                      onClick={() => handlePromoteBackup(b.recipient_id)}
                                      className="font-semibold text-stone-600 dark:text-stone-400 hover:underline"
                                    >
                                      Promote
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Accordion 2: Blocked Near-Miss Decoys */}
                      {matchBrief.rejected_decoys.length > 0 && (
                        <div className="border border-amber-200/90 dark:border-amber-900/60 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowDecoys((prev) => !prev)}
                            className="w-full px-4 py-3 bg-amber-50/60 dark:bg-amber-950/25 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between text-left transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                Safety Guardrail: Blocked Near-Miss Decoys
                              </span>
                              <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                                {matchBrief.rejected_decoys.length} filtered out
                              </span>
                            </div>
                            {showDecoys ? (
                              <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                            )}
                          </button>

                          {showDecoys && (
                            <div className="p-4 bg-white dark:bg-stone-900 space-y-2.5 border-t border-amber-200/70 dark:border-amber-900/50">
                              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
                                <span>
                                  High text similarity, but automatically blocked due to hard storage or capacity limits:
                                </span>
                                <button
                                  onClick={() =>
                                    handleAskInChat('Why them and not Greenline Community Pantry?')
                                  }
                                  className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline shrink-0 ml-2"
                                >
                                  Ask Assistant &rarr;
                                </button>
                              </div>
                              {matchBrief.rejected_decoys.map((decoy) => (
                                <div
                                  key={decoy.recipient_id}
                                  className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 text-xs"
                                >
                                  <div className="flex items-center justify-between font-semibold text-amber-950 dark:text-amber-200">
                                    <span>
                                      {decoy.name} ({decoy.archetype_label})
                                    </span>
                                    <span className="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                                      {(decoy.semantic_similarity * 100).toFixed(0)}% text match
                                    </span>
                                  </div>
                                  <p className="text-amber-800 dark:text-amber-300/90 mt-1">
                                    {decoy.rejection_reasons?.[0]}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Neighborhood Equity View */}
        {activeTab === 'equity' && (
          <EquityAuditChart auditData={equityAudit} isDark={isDark} />
        )}
      </main>

      {/* Slide-Over Coordinator AI Assistant Drawer */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        activePostingId={selectedPostingId}
        activeProductLabel={activePosting?.foodkeeper_product || 'Spinach'}
        externalPrompt={chatExternalPrompt}
        onClearExternalPrompt={() => setChatExternalPrompt(null)}
      />

      {/* Modal: Log New Retail Surplus Offer */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100">
                  Log New Retail Surplus Offer
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Enter grocer donor details to match against verified Atlanta recipients
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePosting} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Product Category
                  </label>
                  <select
                    value={newForm.foodkeeper_product}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, foodkeeper_product: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="Spinach">Spinach / Leafy Greens</option>
                    <option value="Milk">Milk / Cultured Dairy</option>
                    <option value="Bread, commercial">Bakery Bread &amp; Loaves</option>
                    <option value="Deli / Prepared Sandwiches & Salads">
                      Deli Sandwiches &amp; Prepared Trays
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Storage Requirement
                  </label>
                  <select
                    value={newForm.storage_state}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, storage_state: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="refrigerated">Refrigerated (36–40°F)</option>
                    <option value="pantry">Pantry / Ambient</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Donor Grocer / Store
                </label>
                <input
                  type="text"
                  value={newForm.donor_name}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, donor_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Estimated Pallets
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={newForm.pallets_estimated}
                    onChange={(e) =>
                      setNewForm((prev) => ({
                        ...prev,
                        pallets_estimated: parseFloat(e.target.value) || 1,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Pickup Deadline (Hours)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="2"
                    max="72"
                    value={newForm.hours_available}
                    onChange={(e) =>
                      setNewForm((prev) => ({
                        ...prev,
                        hours_available: parseFloat(e.target.value) || 6,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Offer Notes
                </label>
                <textarea
                  rows={3}
                  value={newForm.posting_text}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, posting_text: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPosting}
                  className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmittingPosting ? 'Finding Match...' : 'Post & Find Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Recipient Modal - Primary Agent Dispatcher */}
      {activePosting && (
        <UpdateRecipientModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          posting={activePosting}
          currentRecipient={matchBrief?.primary_match || null}
          backups={matchBrief?.backups || []}
          onRecipientUpdated={(updatedBrief, msg) => {
            setMatchBrief(updatedBrief);
            if (msg) {
              setAssignmentMessage(msg);
              setTimeout(() => setAssignmentMessage(null), 5000);
            }
          }}
        />
      )}
    </div>
  );
};

export default App;
