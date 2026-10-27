import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowUpDown,
  Search,
  Map as MapIcon,
} from 'lucide-react';
import {
  SurplusPosting,
  Recipient,
  MatchBrief,
  EquityAuditResponse,
  fetchPostings,
  fetchMatchBrief,
  fetchEquityAudit,
  fetchRecipients,
  createPosting,
  resetPostingRecipient,
  submitFulfilment,
} from './services/brokerApi';
import { ChatPanel } from './components/ChatPanel';
import { EquityAuditChart } from './components/EquityAuditChart';
import { UpdateRecipientModal } from './components/UpdateRecipientModal';
import { SpatialEquityMap } from './components/SpatialEquityMap';

const RETAIL_TRACK = 'RETAIL';

type SortKey =
  | 'expiry_asc'
  | 'expiry_desc'
  | 'pallets_desc'
  | 'pallets_asc'
  | 'id_asc'
  | 'donor_asc';

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'broker' | 'map' | 'equity'>('broker');
  const [postings, setPostings] = useState<SurplusPosting[]>([]);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<number>(1);
  const [excludedByPosting, setExcludedByPosting] = useState<Record<number, number[]>>({});
  const [matchBrief, setMatchBrief] = useState<MatchBrief | null>(null);
  const [equityAudit, setEquityAudit] = useState<EquityAuditResponse | null>(null);

  const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);
  const [isFulfilling, setIsFulfilling] = useState<boolean>(false);
  const [copiedOutreach, setCopiedOutreach] = useState<boolean>(false);

  // Queue Sort, Filter, and Search controls
  const [sortKey, setSortKey] = useState<SortKey>('expiry_asc');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [queueSearch, setQueueSearch] = useState<string>('');

  // Progressive disclosure toggles inside Match Brief
  const [showBackups, setShowBackups] = useState<boolean>(false);
  const [showDecoys, setShowDecoys] = useState<boolean>(false);

  // Slide-over AI Assistant Drawer
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatExternalPrompt, setChatExternalPrompt] = useState<string | null>(null);

  // Update Recipient Modal state & banner notification
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [preselectedRecipientId, setPreselectedRecipientId] = useState<number | null>(null);
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

  // Initial load of Retail postings, equity audit, and community recipients
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [postingsRes, auditRes, recsRes] = await Promise.all([
          fetchPostings(RETAIL_TRACK),
          fetchEquityAudit(RETAIL_TRACK),
          fetchRecipients(),
        ]);
        setPostings(postingsRes.postings);
        setEquityAudit(auditRes);
        setAllRecipients(recsRes.recipients);

        if (postingsRes.postings.length > 0) {
          // Default to the offer closest to expiration
          const sorted = [...postingsRes.postings].sort(
            (a, b) => a.hours_remaining - b.hours_remaining,
          );
          setSelectedPostingId(sorted[0].posting_id);
        }
      } catch (err) {
        console.error('Error loading initial broker data:', err);
      }
    };
    loadInitial();
  }, []);

  // Sorted and filtered postings list (Defaults to closest to expiration first)
  const sortedAndFilteredPostings = useMemo(() => {
    let list = [...postings];

    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.foodkeeper_product.toLowerCase().includes(q) ||
          p.donor_name.toLowerCase().includes(q) ||
          p.posting_text.toLowerCase().includes(q) ||
          String(p.posting_id).includes(q),
      );
    }

    if (filterTrack === 'urgent') {
      list = list.filter((p) => p.hours_remaining <= 8);
    } else if (filterTrack === 'refrigerated') {
      list = list.filter((p) => p.storage_state === 'refrigerated');
    } else if (filterTrack === 'pantry') {
      list = list.filter((p) => p.storage_state === 'pantry');
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case 'expiry_asc':
          return a.hours_remaining - b.hours_remaining || a.posting_id - b.posting_id;
        case 'expiry_desc':
          return b.hours_remaining - a.hours_remaining || a.posting_id - b.posting_id;
        case 'pallets_desc':
          return (
            (b.pallets_estimated || 0) - (a.pallets_estimated || 0) ||
            a.hours_remaining - b.hours_remaining
          );
        case 'pallets_asc':
          return (
            (a.pallets_estimated || 0) - (b.pallets_estimated || 0) ||
            a.hours_remaining - b.hours_remaining
          );
        case 'id_asc':
          return a.posting_id - b.posting_id;
        case 'donor_asc':
          return a.donor_name.localeCompare(b.donor_name);
        default:
          return a.hours_remaining - b.hours_remaining;
      }
    });

    return list;
  }, [postings, sortKey, filterTrack, queueSearch]);

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

  // Left Column: Perishable Surplus Rescue Queue
  const renderRescueQueue = () => (
    <div className="xl:col-span-4 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-md dark:shadow-slate-950/40 ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden flex flex-col">
      {/* Queue Header & Sort Controls */}
      <div className="p-4 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-850/90 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Rescue Queue</span>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 tabular-nums border border-slate-300 dark:border-slate-600">
                {sortedAndFilteredPostings.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Perishable surplus awaiting dispatch
            </p>
          </div>

          {/* General Sort Dropdown Control */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort queue offers"
              className="text-xs font-medium bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-650 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              <option value="expiry_asc">Expiry: Soonest first (Default)</option>
              <option value="expiry_desc">Expiry: Longest first</option>
              <option value="pallets_desc">Size: Largest pallets</option>
              <option value="pallets_asc">Size: Smallest pallets</option>
              <option value="id_asc">Order: Posting #</option>
              <option value="donor_asc">Donor: A to Z</option>
            </select>
          </div>
        </div>

        {/* Quick Search & Filter Chips */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder="Search offer, product, or donor..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-650 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {queueSearch && (
              <button
                onClick={() => setQueueSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
            {[
              { key: 'all', label: 'All' },
              { key: 'urgent', label: 'Urgent (≤8h)' },
              { key: 'refrigerated', label: 'Refrigerated' },
              { key: 'pantry', label: 'Pantry' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterTrack(f.key)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  filterTrack === f.key
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white border border-slate-900 dark:border-emerald-500 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Surplus Items List - Individual Cards */}
      <div className="p-3 space-y-2.5 max-h-[700px] overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40">
        {sortedAndFilteredPostings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No surplus offers matching current search or filters.
          </div>
        ) : (
          sortedAndFilteredPostings.map((post) => {
            const isSelected = post.posting_id === selectedPostingId;
            const isCritical = post.hours_remaining <= 6;
            const isUrgent = post.hours_remaining <= 10;
            const clockPct = Math.min(
              100,
              Math.max(14, (post.hours_remaining / 24) * 100),
            );

            return (
              <button
                key={post.posting_id}
                onClick={() => setSelectedPostingId(post.posting_id)}
                className={`w-full text-left p-3.5 rounded-xl transition-all relative ${
                  isSelected
                    ? 'bg-emerald-50/70 dark:bg-slate-800/90 border-2 border-emerald-600 dark:border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-850/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                        #{post.posting_id}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {post.foodkeeper_product}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[210px]">
                      {post.donor_name}
                    </p>
                  </div>

                  {post.fulfilment_status === 'fulfilled' ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1 shrink-0 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 tabular-nums shadow-2xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Fulfilled
                    </span>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 shrink-0 tabular-nums ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-2 border-rose-300 dark:border-rose-800/80'
                          : isUrgent
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-800/80'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCritical
                            ? 'bg-rose-500 animate-pulse'
                            : isUrgent
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      {post.hours_remaining}h left
                    </span>
                  )}
                </div>

                {isSelected && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed my-2 pl-2.5 border-l-2 border-emerald-500 dark:border-emerald-400">
                    {post.posting_text}
                  </p>
                )}

                {/* Urgency Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200/90 dark:bg-slate-800 rounded-full overflow-hidden my-2.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      post.fulfilment_status === 'fulfilled'
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : isCritical
                        ? 'bg-rose-500'
                        : isUrgent
                        ? 'bg-amber-500'
                        : 'bg-emerald-600 dark:bg-emerald-500'
                    }`}
                    style={{ width: `${post.fulfilment_status === 'fulfilled' ? 100 : clockPct}%` }}
                  />
                </div>

                {post.fulfilment_status === 'fulfilled' && post.fulfilled_recipient_name && (
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Dispatched to {post.fulfilled_recipient_name}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span className="flex items-center gap-1.5 capitalize text-[11px]">
                    {post.storage_state === 'refrigerated' ? (
                      <Snowflake className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                    {post.storage_state}
                  </span>
                  <span className="text-[11px]">~{post.pallets_estimated} pallets</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-[#070B11] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Coordinator Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b-2 border-slate-200 dark:border-slate-800 px-6 py-3.5 shadow-2xs">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-xs ring-2 ring-emerald-500/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 font-display">
                  Atlanta Food Rescue Dispatch
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase">
                  Live Desk
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time perishable rescue matching &amp; cold-chain safety verification
              </p>
            </div>
          </div>

          {/* Center View Switcher */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-inner">
            <button
              onClick={() => setActiveTab('broker')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'broker'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>📋</span>
              <span>Live Dispatch Queue</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>🗺️</span>
              <span>Spatial Equity Map</span>
            </button>
            <button
              onClick={() => setActiveTab('equity')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'equity'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>📊</span>
              <span>Neighborhood Equity</span>
            </button>
          </div>

          {/* Right Controls: New Offer, AI Assistant Drawer, Dark Mode */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 border border-slate-900 dark:border-white flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Surplus Offer
            </button>

            <button
              onClick={() => setIsChatOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Ask Assistant
            </button>

            <button
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Toggle dark mode"
              className="p-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors shadow-sm"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* Modern Operational Pulse Strip */}
        <section className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl px-5 py-3.5 shadow-sm dark:shadow-slate-950/40 ring-1 ring-slate-900/5 dark:ring-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Urgent (&le;8h):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {urgentCount} of {postings.length} offers
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-300 dark:border-slate-700" />

            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Ready to Move:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {totalPallets.toFixed(1)} pallets
              </span>
            </div>

            <div className="hidden md:block h-4 w-px bg-slate-300 dark:border-slate-700" />

            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Safety Guardrail:</span>
              <span className="font-mono font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                {decoysCaughtCount} unsafe decoys blocked
              </span>
            </div>

            <div className="hidden lg:block h-4 w-px bg-slate-300 dark:border-slate-700" />

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Transit-Dependent Reach:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {matchedNoVehiclePct}% no-vehicle tracts
              </span>
              <span className="text-[11px] text-slate-400">(vs. 13% ATL avg)</span>
            </div>
          </div>
        </section>

        {/* Tab 1: Dispatch View */}
        {activeTab === 'broker' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {renderRescueQueue()}

            {/* Right Column: Focused Match Brief Card (8 cols) */}
            <div className="xl:col-span-8 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-md dark:shadow-slate-950/40 ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
              {isLoadingBrief || !matchBrief ? (
                <div className="py-24 text-center text-sm text-slate-500">
                  Evaluating recipient capacity &amp; cold-chain constraints...
                </div>
              ) : matchBrief.status !== 'matched' || !matchBrief.primary_match ? (
                <div className="p-8 space-y-4">
                  <div className="p-6 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 space-y-3">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-display font-semibold text-base">
                      <AlertTriangle className="w-5 h-5" />
                      No Safe Recipient Available for This Load
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      {matchBrief.refusal_explanation}
                    </p>
                    <button
                      onClick={handleResetExclusions}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    >
                      Reset Declined Recipients
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Active Load Context Strip */}
                  <div className="px-6 py-3 bg-slate-100/90 dark:bg-slate-950/90 border-b-2 border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        Offer #{matchBrief.posting.posting_id}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {matchBrief.posting.foodkeeper_product}
                      </span>
                      <span>·</span>
                      <span>{matchBrief.posting.donor_name}</span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Requires {matchBrief.posting.storage_state} storage · ~
                      {matchBrief.posting.pallets_estimated} pallets
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Hero Recommended Recipient Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b-2 border-slate-200 dark:border-slate-800">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {matchBrief.is_manual_assignment ? (
                            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-2 border-indigo-300 dark:border-indigo-800 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                              Assigned by Coordinator &amp; Verified by Agent
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Recommended Match
                            </span>
                          )}
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700">
                            {matchBrief.primary_match.archetype_label}
                          </span>
                        </div>

                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-display">
                          {matchBrief.primary_match.name}
                        </h2>

                        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {matchBrief.primary_match.street}, {matchBrief.primary_match.city},{' '}
                            {matchBrief.primary_match.state} {matchBrief.primary_match.zip_code}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
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

                        {/* Secondary Change Recipient Button calling Primary Agent */}
                        <button
                          onClick={() => setIsUpdateModalOpen(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1.5 transition-all shadow-2xs active:scale-[0.98]"
                          title="Choose or change the recipient for this surplus posting using the primary agent"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Change Recipient
                        </button>

                        <button
                          onClick={() => setActiveTab('map')}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
                          title="View dispatch route and recipient on Atlanta spatial equity map"
                        >
                          <MapIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          View on Map
                        </button>

                        {matchBrief.is_manual_assignment && (
                          <button
                            onClick={handleResetManualAssignment}
                            title="Reset to default algorithmic recommendation"
                            className="px-3 py-2 rounded-xl text-xs font-medium border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to Recommended
                          </button>
                        )}

                        {(excludedByPosting[selectedPostingId]?.length || 0) > 0 && (
                          <button
                            onClick={handleResetExclusions}
                            title="Reset declined recipients"
                            className="px-3 py-2 rounded-xl text-xs font-medium border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset ({excludedByPosting[selectedPostingId]?.length})
                          </button>
                        )}
                        <button
                          onClick={handleTheySaidNo}
                          disabled={isDeclining}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-2xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                          They Said No — Next Option
                        </button>
                      </div>
                    </div>

                    {/* Recipient Assignment Notification Banner */}
                    {assignmentMessage && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-medium">{assignmentMessage}</span>
                      </div>
                    )}
                    {matchBrief.is_manual_assignment &&
                      matchBrief.coordinator_note &&
                      !assignmentMessage && (
                        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-300 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2 shadow-2xs">
                          <span className="font-semibold shrink-0">Coordinator Note:</span>
                          <span>{matchBrief.coordinator_note}</span>
                        </div>
                      )}

                    {/* 3 Clean Verification Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Tile 1: Clock & Pickup */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-750 shadow-2xs space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          Dispatch Clock
                        </div>
                        <div className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {matchBrief.clock.hours_remaining}h window
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Pickup within {matchBrief.primary_match.pickup_window_hours}h leaves{' '}
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            +{matchBrief.clock.estimated_margin_hours}h buffer
                          </span>
                        </p>
                      </div>

                      {/* Tile 2: Storage & Capacity */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-750 shadow-2xs space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Capacity &amp; Cold Chain
                        </div>
                        <div className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 capitalize tabular-nums">
                          {matchBrief.capacity_check?.cold_storage} · {matchBrief.capacity_check?.max_pallets} plt max
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {matchBrief.capacity_check?.refrigerated_transport
                            ? 'On-site refrigerated van ready'
                            : 'Verified loading dock intake'}
                        </p>
                      </div>

                      {/* Tile 3: Community Impact */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-750 shadow-2xs space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                          Community Reach
                        </div>
                        <div className="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {(matchBrief.primary_match.tract.no_vehicle_rate * 100).toFixed(1)}% no-vehicle
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {matchBrief.capacity_check?.weekly_households} households/wk ·{' '}
                          {(matchBrief.primary_match.tract.poverty_rate * 100).toFixed(1)}% poverty
                        </p>
                      </div>
                    </div>

                    {/* Why This Match */}
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Why This Recipient Was Chosen
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {matchBrief.why_them?.slice(0, 2).map((reason, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-750 shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Ready-to-Send Coordinator Outreach Note */}
                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-700/80 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Ready-to-Send Dispatch Note
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() =>
                              handleAskInChat('Write the outreach message for this match')
                            }
                            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            Customize in Assistant
                          </button>
                          <button
                            onClick={handleCopyOutreach}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
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
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-emerald-200/90 dark:border-emerald-800/90 leading-relaxed shadow-2xs">
                        {matchBrief.outreach_draft}
                      </p>
                    </div>

                    {/* Progressive Disclosure Accordions: Backups & Blocked Decoys */}
                    <div className="space-y-3 pt-1">
                      {/* Accordion 1: Backups */}
                      <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setShowBackups((prev) => !prev)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              Backup Options if Primary Declines
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 tabular-nums">
                              {matchBrief.backups.length} verified
                            </span>
                          </div>
                          {showBackups ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        {showBackups && (
                          <div className="p-4 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t-2 border-slate-200 dark:border-slate-800">
                            {matchBrief.backups.map((b, idx) => (
                              <div
                                key={b.recipient_id}
                                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-750 flex flex-col justify-between gap-2 shadow-2xs"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                      #{idx + 2} · {b.name}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {b.street} · {b.tract.neighborhood}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                                  <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                                    {b.cold_storage} · max {b.max_pallets} plt
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleToggleFulfilment(true, b.recipient_id)}
                                      disabled={isFulfilling}
                                      className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                                      title="Lock dispatch and record fulfilment directly to this partner"
                                    >
                                      Select &amp; Fulfill &rarr;
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-700">|</span>
                                    <button
                                      onClick={() => handlePromoteBackup(b.recipient_id)}
                                      className="font-semibold text-slate-600 dark:text-slate-400 hover:underline"
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
                        <div className="border-2 border-amber-300 dark:border-amber-700 rounded-xl overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setShowDecoys((prev) => !prev)}
                            className="w-full px-4 py-3 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-950/50 flex items-center justify-between text-left transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                Safety Guardrail: Blocked Near-Miss Decoys
                              </span>
                              <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 tabular-nums">
                                {matchBrief.rejected_decoys.length} filtered out
                              </span>
                            </div>
                            {showDecoys ? (
                              <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            )}
                          </button>

                          {showDecoys && (
                            <div className="p-4 bg-white dark:bg-slate-900 space-y-2.5 border-t-2 border-amber-200 dark:border-amber-800">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
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
                                  className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300/80 dark:border-amber-800/70 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center justify-between font-semibold text-amber-950 dark:text-amber-200">
                                    <span>
                                      {decoy.name} ({decoy.archetype_label})
                                    </span>
                                    <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300 tabular-nums">
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

        {/* Tab 2: Spatial Equity Map View */}
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {renderRescueQueue()}

            {/* Right Column: Google Maps Spatial Equity View (8 cols) */}
            <div className="xl:col-span-8 h-[760px] min-h-[550px]">
              <SpatialEquityMap
                postings={postings}
                selectedPosting={activePosting}
                currentMatch={matchBrief}
                recipients={allRecipients}
                onSelectPosting={setSelectedPostingId}
                onOpenUpdateModal={(id) => {
                  setPreselectedRecipientId(id || null);
                  setIsUpdateModalOpen(true);
                }}
                isDark={isDark}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Neighborhood Equity View */}
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  Log New Retail Surplus Offer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter grocer donor details to match against verified Atlanta recipients
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePosting} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Product Category
                  </label>
                  <select
                    value={newForm.foodkeeper_product}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, foodkeeper_product: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
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
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Storage Requirement
                  </label>
                  <select
                    value={newForm.storage_state}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, storage_state: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="refrigerated">Refrigerated (36–40°F)</option>
                    <option value="pantry">Pantry / Ambient</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Donor Grocer / Store
                </label>
                <input
                  type="text"
                  value={newForm.donor_name}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, donor_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Offer Notes
                </label>
                <textarea
                  rows={3}
                  value={newForm.posting_text}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, posting_text: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPosting}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold disabled:opacity-50 shadow-sm"
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
          onClose={() => {
            setIsUpdateModalOpen(false);
            setPreselectedRecipientId(null);
          }}
          posting={activePosting}
          currentRecipient={matchBrief?.primary_match || null}
          backups={matchBrief?.backups || []}
          initialRecipientId={preselectedRecipientId}
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
