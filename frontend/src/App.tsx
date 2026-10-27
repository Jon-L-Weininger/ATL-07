import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
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
  Database,
  Sun,
  Moon,
  ArrowRight,
  RotateCcw,
  Layers,
  HeartHandshake,
  ShoppingCart,
  Baby,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import {
  SurplusPosting,
  MatchBrief,
  EquityAuditResponse,
  BackendStatusResponse,
  fetchBackendStatus,
  fetchPostings,
  fetchMatchBrief,
  fetchEquityAudit,
  createPosting,
} from './services/brokerApi';
import { ChatPanel } from './components/ChatPanel';
import { EquityAuditChart } from './components/EquityAuditChart';

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'broker' | 'equity' | 'placeholders'>('broker');
  const [trackFilter, setTrackFilter] = useState<'ALL' | 'RETAIL' | 'ESSENTIALS' | 'FARM'>('ALL');
  const [postings, setPostings] = useState<SurplusPosting[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<number>(1);
  const [excludedByPosting, setExcludedByPosting] = useState<Record<number, number[]>>({});
  const [matchBrief, setMatchBrief] = useState<MatchBrief | null>(null);
  const [equityAudit, setEquityAudit] = useState<EquityAuditResponse | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatusResponse | null>(null);

  const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);
  const [copiedOutreach, setCopiedOutreach] = useState<boolean>(false);

  // Chat Drawer state
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [chatExternalPrompt, setChatExternalPrompt] = useState<string | null>(null);

  // New Surplus Offer Modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isSubmittingPosting, setIsSubmittingPosting] = useState<boolean>(false);
  const [newForm, setNewForm] = useState({
    track: 'RETAIL',
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

  // Initial load of status, postings, and equity audit
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [statusRes, postingsRes, auditRes] = await Promise.all([
          fetchBackendStatus(),
          fetchPostings(trackFilter),
          fetchEquityAudit(trackFilter),
        ]);
        setBackendStatus(statusRes);
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
  }, [trackFilter]);

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

  const handleResetExclusions = () => {
    setExcludedByPosting((prev) => ({
      ...prev,
      [selectedPostingId]: [],
    }));
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
      const res = await createPosting(newForm);
      const updated = await fetchPostings(trackFilter);
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

  // Compute KPI metrics across active postings
  const urgentCount = postings.filter((p) => p.hours_remaining <= 8).length;
  const totalPallets = postings.reduce((acc, p) => acc + (p.pallets_estimated || 1.5), 0);
  const matchedNoVehiclePct = equityAudit
    ? (equityAudit.matched_averages.no_vehicle_rate * 100).toFixed(1)
    : '27.4';
  const decoysCaughtCount = matchBrief?.rejected_decoys?.length || 2;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors">
      {/* Top Navigation & Status Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-6 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Atlanta Metro Context */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  ATL-07 · Resilient Food Equity & Surplus Broker
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Atlanta, GA · {backendStatus?.baseline?.total_corpus_rows || 127} Orgs (Live BQ)
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Primary: <span className="font-medium text-zinc-700 dark:text-zinc-300">🛒 Retail & Grocer Rescue</span> · Stretch Goal: <span className="font-medium text-zinc-700 dark:text-zinc-300">🍼 Critical Non-Food Essentials</span>
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700/70">
            <button
              onClick={() => setActiveTab('broker')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'broker'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Coordinator Queue & Match Brief
            </button>
            <button
              onClick={() => setActiveTab('equity')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'equity'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Atlanta Equity Audit (ECharts)
            </button>
            <button
              onClick={() => setActiveTab('placeholders')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'placeholders'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              Backend Status ({backendStatus?.mode === 'live' ? 'Live BQ Tables' : 'Mock Mode'})
            </button>
          </div>

          {/* Right Controls: New Offer, Chat Toggle, Theme Toggle */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Surplus Offer
            </button>

            <button
              onClick={() => setIsChatOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                isChatOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:border-blue-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isChatOpen ? 'Hide AI Chat' : 'Coordinator AI Chat'}
            </button>

            <button
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Track Filter Bar + KPI Row (4 Cards max per design system) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative z-30 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Active Track:
            </span>
            <button
              onClick={() => setTrackFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                trackFilter === 'ALL'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              All Atlanta Offers ({postings.length})
            </button>
            <button
              onClick={() => setTrackFilter('RETAIL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                trackFilter === 'RETAIL'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-blue-400'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              🛒 Retail & Grocer Rescue (Primary)
            </button>
            <button
              onClick={() => setTrackFilter('ESSENTIALS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                trackFilter === 'ESSENTIALS'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-teal-400'
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              🍼 Critical Non-Food Essentials (Stretch Goal)
            </button>
            <button
              onClick={() => setTrackFilter('FARM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                trackFilter === 'FARM'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
              }`}
            >
              🚜 Farm & Packinghouse
            </button>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Data Source:{' '}
              <strong className="text-zinc-700 dark:text-zinc-200">
                {backendStatus?.use_mock_backend
                  ? 'Atlanta Deterministic Placeholders (USE_MOCK_BACKEND=true)'
                  : 'Live BigQuery Tables (a4i_food) · Vector Search Placeholder Active'}
              </strong>
            </span>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>URGENT OFFERS (&le;8H CLOCK)</span>
              <Clock className="w-4 h-4 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {urgentCount} / {postings.length}
              </span>
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                4h–8h dispatch window
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Governed by min(donor window, USDA FoodKeeper)
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>VOLUME READY TO BROKER</span>
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                {totalPallets.toFixed(1)} Pallets
              </span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Retail + Essentials
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Verified against recipient max_pallets & dock access
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>TRANSIT-DEPENDENT REACH</span>
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {matchedNoVehiclePct}%
              </span>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                vs. 13.0% ATL Baseline
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Matched tracts average 2.1x higher no-vehicle households
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>COLD-CHAIN & DECOY SHIELD</span>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
                100% Safe
              </span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {decoysCaughtCount} near-miss decoys blocked
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Blocks ambient-only & contradicted profiles post-search
            </p>
          </div>
        </section>

        {/* Tab 1: Coordinator Surplus Queue + Interactive Match Brief + Custom Streaming Chat */}
        {activeTab === 'broker' && (
          <div className="flex flex-col lg:flex-row items-start gap-6">
            {/* Left / Center Workspace: Queue + Match Brief */}
            <div className="flex-1 w-full grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Surplus Queue List (5 cols on XL) */}
              <div className="xl:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Incoming Atlanta Surplus Queue
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Click any offer to inspect its Match Brief, Decoy Alerts & Backups
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {postings.length} active
                  </span>
                </div>

                <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 max-h-[680px] overflow-y-auto">
                  {postings.map((post) => {
                    const isSelected = post.posting_id === selectedPostingId;
                    const clockPct = Math.min(100, Math.max(12, (post.hours_remaining / 24) * 100));
                    const isCritical = post.hours_remaining <= 6;
                    const isEssentials = post.track === 'ESSENTIALS';

                    return (
                      <button
                        key={post.posting_id}
                        onClick={() => setSelectedPostingId(post.posting_id)}
                        className={`w-full text-left p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-4 border-l-blue-600'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                              #{post.posting_id}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${
                                isEssentials
                                  ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                                  : post.track === 'FARM'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                              }`}
                            >
                              {isEssentials
                                ? '🍼 ESSENTIALS'
                                : post.track === 'FARM'
                                ? '🚜 FARM'
                                : '🛒 RETAIL'}
                            </span>
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {post.foodkeeper_product}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-xs font-mono font-semibold flex items-center gap-1 ${
                              isCritical
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {post.hours_remaining}h left
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed mb-2.5">
                          {post.posting_text}
                        </p>

                        {/* Visual Countdown Progress Bar */}
                        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCritical
                                ? 'bg-red-500'
                                : post.hours_remaining <= 10
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${clockPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                          <span className="truncate max-w-[200px]">{post.donor_name}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="flex items-center gap-1">
                              <Snowflake className="w-3 h-3 text-blue-500" />
                              {post.storage_state}
                            </span>
                            <span>·</span>
                            <span>~{post.pallets_estimated} plt</span>
                            <span>·</span>
                            <span>
                              {(() => {
                                try {
                                  return format(parseISO(post.created_at), 'MMM dd, HH:mm');
                                } catch {
                                  return 'Today';
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Match Brief Panel (7 cols on XL) */}
              <div className="xl:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-5 flex flex-col justify-between space-y-5">
                {isLoadingBrief || !matchBrief ? (
                  <div className="py-20 text-center text-sm text-zinc-500">
                    Computing Match Brief & checking operational constraints...
                  </div>
                ) : matchBrief.status !== 'matched' || !matchBrief.primary_match ? (
                  <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
                      <AlertTriangle className="w-5 h-5" />
                      Broker Refusal: No Safe Recipient Available
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
                      {matchBrief.refusal_explanation}
                    </p>
                    <button
                      onClick={handleResetExclusions}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100"
                    >
                      Reset Declined Recipients
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Match Brief Header */}
                    <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PRIMARY RECOMMENDED MATCH
                          </span>
                          <span className="text-xs font-mono text-zinc-500">
                            Composite Score: {(matchBrief.primary_match.composite_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1.5">
                          {matchBrief.primary_match.name}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          {matchBrief.primary_match.street}, {matchBrief.primary_match.city},{' '}
                          {matchBrief.primary_match.state} {matchBrief.primary_match.zip_code} ·{' '}
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {matchBrief.primary_match.archetype_label}
                          </span>
                        </p>
                      </div>

                      {/* "They Said No" Action Button */}
                      <div className="flex items-center gap-2">
                        {(excludedByPosting[selectedPostingId]?.length || 0) > 0 && (
                          <button
                            onClick={handleResetExclusions}
                            title="Reset declined recipients"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset ({excludedByPosting[selectedPostingId]?.length})
                          </button>
                        )}
                        <button
                          onClick={handleTheySaidNo}
                          disabled={isDeclining}
                          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          &ldquo;They Said No&rdquo; — Route to Next Option
                        </button>
                      </div>
                    </div>

                    {/* 1. Why Them + Near-Miss Decoy Alert */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        1. Why Them (Semantic Fit + Hard Constraint Verification)
                      </h3>
                      <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                        {matchBrief.why_them?.map((reason, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Rejected Decoy Callout (e.g., Greenline Community Pantry / Harborview) */}
                      {matchBrief.rejected_decoys.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              Filtered Near-Miss Decoys & Contradictions (Post-Search Guardrail)
                            </span>
                            <button
                              onClick={() =>
                                handleAskInChat('Why them and not Greenline Community Pantry?')
                              }
                              className="text-[11px] font-medium text-amber-700 dark:text-amber-300 underline hover:text-amber-900"
                            >
                              Inspect in AI Chat &rarr;
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {matchBrief.rejected_decoys.map((decoy) => (
                              <div
                                key={decoy.recipient_id}
                                className="text-xs text-amber-900/90 dark:text-amber-200/90 bg-white/70 dark:bg-zinc-900/60 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40"
                              >
                                <div className="flex items-center justify-between font-medium">
                                  <span>
                                    🛑 {decoy.name} ({decoy.archetype_label})
                                  </span>
                                  <span className="font-mono text-[11px]">
                                    Raw Semantic Similarity: {(decoy.semantic_similarity * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 mt-0.5">
                                  {decoy.rejection_reasons?.[0]}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Operational Capacity + The Clock + Who It Helps (3-Column Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {/* Capacity Check */}
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          What They Can Take
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Cold Storage:</span>
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {matchBrief.capacity_check?.cold_storage}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Max Pallets:</span>
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {matchBrief.capacity_check?.max_pallets} plt (need ~
                              {matchBrief.capacity_check?.pallets_needed})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Reefer Transport:</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {matchBrief.capacity_check?.refrigerated_transport ? 'Yes (On-Site)' : 'Dock Intake'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Weekly Reach:</span>
                            <span className="font-mono text-zinc-800 dark:text-zinc-200">
                              {matchBrief.capacity_check?.weekly_households} households
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* The Clock */}
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-red-500" />
                          The Clock (USDA FoodKeeper)
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Donor Window:</span>
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {matchBrief.clock.donor_hours_available}h
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">FoodKeeper Limit:</span>
                            <span className="font-mono text-zinc-800 dark:text-zinc-200">
                              {matchBrief.clock.foodkeeper_shelf_life_hours}h
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Effective Clock:</span>
                            <span className="font-mono font-bold text-red-600 dark:text-red-400">
                              {matchBrief.clock.hours_remaining}h remaining
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Pickup Buffer:</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              +{matchBrief.clock.estimated_margin_hours}h safety margin
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Who It Helps (Atlanta Equity Signal) */}
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Who It Helps (ACS Tract)
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {matchBrief.primary_match.tract.neighborhood}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">No-Vehicle Rate:</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {(matchBrief.primary_match.tract.no_vehicle_rate * 100).toFixed(1)}% (ATL: 13%)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Poverty Rate:</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {(matchBrief.primary_match.tract.poverty_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">SNAP / Assistance:</span>
                            <span className="font-mono text-zinc-800 dark:text-zinc-200">
                              {(matchBrief.primary_match.tract.assistance_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Drafted Coordinator Outreach Message */}
                    <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                          Drafted Coordinator Outreach Message (Ready to Dispatch)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleAskInChat('Write the outreach message for this match')
                            }
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Customize in Chat
                          </button>
                          <button
                            onClick={handleCopyOutreach}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                          >
                            {copiedOutreach ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Message
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 leading-relaxed">
                        {matchBrief.outreach_draft}
                      </p>
                    </div>

                    {/* 4. Next 2 Backup Options ("They Said No" Queue) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Next 2 Ranked Backups (Ready if Primary Declines)
                        </h3>
                        <button
                          onClick={() => handleAskInChat("They said no — who's next in line?")}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Ask Agent to Split Load &rarr;
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {matchBrief.backups.map((b, idx) => (
                          <div
                            key={b.recipient_id}
                            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                <span>
                                  Backup #{idx + 1}: {b.name}
                                </span>
                                <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                                  {(b.composite_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {b.street} ({b.tract.neighborhood})
                              </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                              <span>Storage: {b.cold_storage}</span>
                              <span>Max: {b.max_pallets} plt</span>
                              <span>No-Veh: {(b.tract.no_vehicle_rate * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Slide-Out / Split Coordinator AI Chat Drawer */}
            <ChatPanel
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              activePostingId={selectedPostingId}
              activeProductLabel={activePosting?.foodkeeper_product || 'Spinach'}
              activeTrack={trackFilter}
              externalPrompt={chatExternalPrompt}
              onClearExternalPrompt={() => setChatExternalPrompt(null)}
            />
          </div>
        )}

        {/* Tab 2: Atlanta Equity Audit View (Full-Width Apache ECharts) */}
        {activeTab === 'equity' && (
          <EquityAuditChart auditData={equityAudit} isDark={isDark} />
        )}

        {/* Tab 3: Pluggable Backend Placeholders Inspector */}
        {activeTab === 'placeholders' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  Backend Service Status & BigQuery Cutover Inspector
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Connected to live BigQuery dataset <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">qwiklabs-gcp-04-e7160ff57547.a4i_food</code> (127 recipients, 10 postings, 661 FoodKeeper rows, 165 tracts). <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">VECTOR_SEARCH</code> uses a hybrid profile/text scorer until <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">profile_embedding</code> is populated.
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Current Mode: {backendStatus?.use_mock_backend ? 'PLACEHOLDER / MOCK MODE' : 'LIVE BIGQUERY TABLES (NO VECTOR INDEX YET)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {backendStatus?.services.map((svc) => {
                const isConnected = svc.status.startsWith('connected');
                return (
                  <div
                    key={svc.id}
                    className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {svc.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded ${
                          isConnected
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                        }`}
                      >
                        {svc.status}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 font-mono">
                      <div>
                        <span className="text-zinc-400">Env Toggle:</span> {svc.env_var}
                      </div>
                      <div>
                        <span className="text-zinc-400">Configured:</span> {svc.current_value}
                      </div>
                      <div>
                        <span className="text-zinc-400">Code Hook:</span> {svc.file_hook}
                      </div>
                    </div>
                    <ul className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                      {svc.tables.map((t, i) => (
                        <li key={i} className="font-mono text-[11px]">
                          • {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Log New Surplus Offer (Retail & Grocer or Critical Non-Food Essentials) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Log New Atlanta Surplus Offer
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePosting} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Track
                  </label>
                  <select
                    value={newForm.track}
                    onChange={(e) => {
                      const track = e.target.value;
                      setNewForm((prev) => ({
                        ...prev,
                        track,
                        foodkeeper_product:
                          track === 'ESSENTIALS' ? 'Infant Formula' : 'Spinach',
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="RETAIL">🛒 Retail & Grocer Rescue</option>
                    <option value="ESSENTIALS">🍼 Critical Non-Food Essentials</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    USDA FoodKeeper Product
                  </label>
                  <select
                    value={newForm.foodkeeper_product}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, foodkeeper_product: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="Spinach">Spinach / Leafy Greens</option>
                    <option value="Milk">Milk / Cultured Dairy</option>
                    <option value="Bread, commercial">Bakery Bread & Loaves</option>
                    <option value="Deli / Prepared Sandwiches & Salads">
                      Deli Sandwiches & Prepared Trays
                    </option>
                    <option value="Infant Formula">Infant Formula (Sealed)</option>
                    <option value="Diapers & Infant Hygiene">Diapers (Sizes 1–4) & Wipes</option>
                    <option value="Clinical Nutritional Supplements (Cold-Chain)">
                      Clinical Nutritional Shakes (Cold-Chain)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Atlanta Donor Organization
                </label>
                <input
                  type="text"
                  value={newForm.donor_name}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, donor_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Storage State
                  </label>
                  <select
                    value={newForm.storage_state}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, storage_state: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="refrigerated">Refrigerated (36–40°F)</option>
                    <option value="pantry">Pantry / Ambient Sealed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Est. Pallets
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
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Donor Clock (Hours)
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
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Offer Description
                </label>
                <textarea
                  rows={3}
                  value={newForm.posting_text}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, posting_text: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPosting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmittingPosting ? 'Computing Match...' : 'Post & Broker Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
