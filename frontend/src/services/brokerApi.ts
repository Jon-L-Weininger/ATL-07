import axios from 'axios';

export interface TractDemographics {
  geo_id: string;
  neighborhood: string;
  tract_lat: number;
  tract_lon: number;
  total_pop: number;
  median_income: number;
  poverty_rate: number;
  no_vehicle_rate: number;
  assistance_rate: number;
}

export interface Recipient {
  recipient_id: number;
  ein: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  ntee_code: string;
  archetype: string;
  archetype_label: string;
  cold_storage: string;
  frozen_storage: boolean;
  loading_dock: boolean;
  refrigerated_transport: boolean;
  max_pallets: number;
  pickup_window_hours: number;
  weekly_households: number;
  reported_income: number;
  populations_served: string;
  service_days: string;
  profile_text: string;
  profile_source: 'generated' | 'planted';
  planted_role?: string | null;
  latitude: number;
  longitude: number;
  geo_id: string;
  semantic_similarity: number;
  equity_score: number;
  composite_score: number;
  tract: TractDemographics;
  clock_margin_hours: number;
  rejection_reasons?: string[];
}

export interface SurplusPosting {
  posting_id: number;
  track: 'RETAIL' | 'ESSENTIALS' | 'FARM';
  donor_name: string;
  posting_text: string;
  foodkeeper_product: string;
  storage_state: 'refrigerated' | 'pantry' | 'frozen';
  pallets_estimated: number;
  hours_available: number;
  shelf_life_hours: number;
  hours_remaining: number;
  created_at: string;
  urgency_tier: 'critical' | 'urgent' | 'standard';
  status?: 'open' | 'fulfilled';
  fulfilment_status?: 'open' | 'fulfilled';
  fulfilled_recipient_id?: number | null;
  fulfilled_recipient_name?: string | null;
}

export interface MatchBrief {
  posting: SurplusPosting;
  status: 'matched' | 'refused_unsafe_or_no_capacity';
  refusal_explanation?: string;
  primary_match?: Recipient;
  why_them?: string[];
  fulfilment?: {
    is_fulfilled: boolean;
    recipient_id: number | null;
    recipient_name: string | null;
    product_id: number | null;
  };
  capacity_check?: {
    cold_storage: string;
    frozen_storage: boolean;
    loading_dock: boolean;
    refrigerated_transport: boolean;
    max_pallets: number;
    pallets_needed: number;
    weekly_households: number;
    service_days: string;
  };
  clock: {
    query: string;
    matched_product_id: string | number;
    matched_product_name: string;
    matched_product_subtitle: string;
    match_resolution: string;
    storage_state: string;
    donor_hours_available: number;
    foodkeeper_shelf_life_hours: number;
    foodkeeper_note: string;
    hours_remaining: number;
    governing_constraint: string;
    recipient_pickup_window_hours?: number;
    estimated_margin_hours?: number;
  };
  equity_context?: {
    tract: TractDemographics;
    atlanta_baseline: {
      metro: string;
      irs_orgs_count: number;
      planted_cases_count: number;
      total_corpus_rows: number;
      no_vehicle_rate: number;
      poverty_rate: number;
      assistance_rate: number;
    };
  };
  outreach_draft?: string;
  rejected_decoys: Recipient[];
  backups: Recipient[];
  excluded_recipient_ids?: number[];
  is_manual_assignment?: boolean;
  coordinator_note?: string;
}

export interface EquityAuditResponse {
  track_filter: string;
  atlanta_baseline: {
    metro: string;
    irs_orgs_count: number;
    planted_cases_count: number;
    total_corpus_rows: number;
    no_vehicle_rate: number;
    poverty_rate: number;
    assistance_rate: number;
  };
  matched_averages: {
    poverty_rate: number;
    no_vehicle_rate: number;
    assistance_rate: number;
  };
  matched_postings: Array<{
    posting_id: number;
    track: string;
    product: string;
    recipient_id: number;
    recipient_name: string;
    archetype_label: string;
    neighborhood: string;
    geo_id: string;
    poverty_rate: number;
    no_vehicle_rate: number;
    assistance_rate: number;
    weekly_households: number;
  }>;
  all_tracts: TractDemographics[];
}

export interface BackendServiceStatus {
  id: string;
  name: string;
  status: string;
  env_var: string;
  current_value: string;
  tables: string[];
  file_hook: string;
}

export interface BackendStatusResponse {
  mode: 'mock' | 'live';
  use_mock_backend: boolean;
  use_vector_search?: boolean;
  metro: string;
  primary_track: string;
  stretch_track: string;
  live_counts?: {
    recipients: number;
    postings: number;
    fulfilments?: number;
  };
  baseline: {
    metro: string;
    irs_orgs_count: number;
    planted_cases_count: number;
    total_corpus_rows: number;
    tracts_count?: number;
    no_vehicle_rate: number;
    poverty_rate: number;
    assistance_rate: number;
  };
  services: BackendServiceStatus[];
}

const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
});

export async function fetchBackendStatus(): Promise<BackendStatusResponse> {
  const { data } = await api.get<BackendStatusResponse>('/status');
  return data;
}

export async function fetchPostings(track: string = 'ALL'): Promise<{
  track: string;
  count: number;
  postings: SurplusPosting[];
  recipients_count: number;
}> {
  const { data } = await api.get('/postings', { params: { track } });
  return data;
}

export async function createPosting(payload: {
  track: string;
  donor_name: string;
  posting_text: string;
  foodkeeper_product: string;
  storage_state: string;
  pallets_estimated: number;
  hours_available: number;
}): Promise<{ posting: SurplusPosting; initial_brief: MatchBrief }> {
  const { data } = await api.post('/postings', payload);
  return data;
}

export async function fetchRecipients(
  query?: string,
  storage?: string,
): Promise<{ count: number; recipients: Recipient[] }> {
  const { data } = await api.get('/recipients', {
    params: { query, storage },
  });
  return data;
}

export async function fetchMatchBrief(
  postingId: number,
  excludedRecipientIds: number[] = [],
  overrideRecipientId?: number,
): Promise<MatchBrief> {
  const { data } = await api.post<MatchBrief>('/match-brief', {
    posting_id: postingId,
    excluded_recipient_ids: excludedRecipientIds,
    override_recipient_id: overrideRecipientId,
  });
  return data;
}

export async function updatePostingRecipient(
  postingId: number,
  recipientId: number,
  note?: string,
): Promise<{
  success: boolean;
  message?: string;
  warning?: boolean;
  error?: string;
  brief?: MatchBrief;
  rejection_reasons?: string[];
}> {
  const { data } = await api.post(`/postings/${postingId}/recipient`, {
    recipient_id: recipientId,
    note,
  });
  return data;
}

export async function resetPostingRecipient(
  postingId: number,
): Promise<{ success: boolean; message: string; brief: MatchBrief }> {
  const { data } = await api.delete(`/postings/${postingId}/recipient`);
  return data;
}

export async function fetchEquityAudit(track: string = 'ALL'): Promise<EquityAuditResponse> {
  const { data } = await api.get<EquityAuditResponse>('/equity-audit', {
    params: { track },
  });
  return data;
}

export async function submitFulfilment(
  postingId: number,
  recipientId: number,
  productId?: number | string | null,
  fulfilmentFlg: boolean = true,
): Promise<{
  result: {
    success: boolean;
    posting_id: number;
    recipient_id: number;
    recipient_name: string;
    product_id: number | null;
    fulfilled: boolean;
    status: 'fulfilled' | 'open';
  };
  brief: MatchBrief;
  posting: SurplusPosting;
}> {
  const { data } = await api.post('/fulfilments', {
    posting_id: postingId,
    recipient_id: recipientId,
    product_id: productId ?? null,
    fulfilment_flg: fulfilmentFlg,
  });
  return data;
}

export async function fetchFulfilments(): Promise<{
  count: number;
  fulfilments: Array<{
    posting_id: number;
    recipient_id: number;
    product_id: number | null;
    fulfilled: boolean;
  }>;
}> {
  const { data } = await api.get('/fulfilments');
  return data;
}
