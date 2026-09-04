

export interface Translation {
  lang: string;
  text: string | null;
  author?: string;
}

export interface TermStats {
  draft: number;
  review: number;
  approved: number;
  rejected: number;
  merged: number;
}

export interface Term {
  id: string;
  prefLabel: string;
  definition: string;
  translations: Record<string, string | null>;
  contributors: string[];
  category: string;
  stats?: TermStats;
}

export interface User {
  id?: number;          // New: integer user ID (preferred)
  user_id?: number;     // Alias for consistency
  username: string;     // Now mutable display name, but still unique
  name: string;
  avatar: string;
  token: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  hasGachaAccess?: boolean;
  orcid?: string;       // ORCID iD (still supported)
  reputation?: number;  // User reputation score
  email?: string | null; // User email address (if configured)
  languagePreferences?: {
    nativeLanguage?: string;
    translationLanguages?: string[];
    preferredLanguages?: string[];
    visibleExtraLanguages?: string[];
    hasSeenOnboarding?: boolean;
  };
}

export interface Stats {
  translatedCount: number;
  contributionRank: number;
}

// API Response Interfaces
export interface ApiTranslation {
  id: number;
  term_field_id: number;
  language: string;
  value: string;
  created_by_id?: number;      // New: user ID who created
  created_by?: string;          // Deprecated: kept for backward compat
  modified_by_id?: number;      // New: user ID who modified
  reviewed_by_id?: number;      // New: user ID who reviewed
  status?: 'draft' | 'review' | 'approved' | 'rejected' | 'merged';
  created_at?: string;
  updated_at?: string;
  modified_at?: string;
}

export interface ApiField {
  id: number;
  term_id: number;
  field_uri: string;
  field_term?: string; // DEPRECATED: No longer in database, kept for backward compatibility
  original_value: string;
  translations: ApiTranslation[];
  created_at?: string;
  updated_at?: string;
  source_id?: number;
  field_role?: 'label' | 'reference' | 'translatable'; // Identifies field purpose
  originalValueTranslation?: ApiTranslation; // English or undefined language translation for reference
  bestTranslation?: ApiTranslation; // Best translation based on user preferences
}

export interface ApiTerm {
  id: number;
  uri: string;
  created_at: string;
  updated_at: string;
  source_id?: number;
  fields: ApiField[];
  labelField?: { field_uri: string } | null;  // Simplified: only field_uri
  referenceFields?: { field_uri: string }[];  // Simplified: only field_uri array
}

export interface ApiUserActivity {
  id: number;
  user_id: number;              // New: user ID (replaces user)
  user?: string;                // Deprecated: kept for backward compat
  action: string;
  term_id: number | null;
  term_field_id: number | null;
  translation_id: number | null;
  appeal_id: number | null;
  appeal_message_id: number | null;
  extra: string | null; // JSON string
  created_at: string;
}

export interface ApiPublicUser {
  id: number;            // New: integer user ID
  username: string;
  name?: string;
  reputation: number;
  joined_at: string;
  extra: string | null;
}

export interface ApiAuthProvider {
  id: number;
  user_id: number;
  provider: string;      // 'orcid', 'github', 'google', 'email', etc.
  provider_id: string;   // Provider-specific user ID
  email?: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiAppealMessage {
  id: number;
  appeal_id: number;
  author_id: number;        // New: user ID (replaces author)
  author?: string;          // Deprecated: kept for backward compat
  message: string;
  created_at: string;
}

export interface ApiAppeal {
  id: number;
  appeal_number?: string;
  translation_id: number;
  opened_by_id: number;     // New: user ID (replaces opened_by)
  opened_by?: string;       // Deprecated: kept for backward compat
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed' | 'resolved';
  resolution: string | null; // Initial reason
  messages?: ApiAppealMessage[]; // Optional: populated via join or separate call
}

export interface ApiTermDiscussionMessage {
  id: number;
  discussion_id: number;
  author_id: number;
  author: string;
  message: string;
  created_at: string;
}

export interface ApiTermDiscussion {
  id: number;
  term_id: number;
  started_by_id: number;
  started_by: string;
  title: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  message_count?: number;
  messages?: ApiTermDiscussionMessage[];
}

export interface ApiLanguage {
  code: string;
  name: string;
  native_name: string;
}

export interface ApiCommunityGoal {
  id: number;
  title: string;
  description: string | null;
  goal_type: 'translation_count' | 'collection';
  target_count: number | null;
  target_language: string | null;
  collection_id: number | null;
  collection_path?: string | null;
  is_recurring: number;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_by_id: number;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
  is_dismissed?: boolean;
  linked_communities?: Array<{
    id: number;
    name: string;
    language_code: string | null;
  }>;
}

export interface ApiCommunityGoalProgress {
  goal_id: number;
  current_count: number;
  target_count: number | null;
  progress_percentage: number;
  is_complete: boolean;
  missing_translations?: Record<string, number> | null;
}

// Communities Feature Types

export interface ApiCommunity {
  id: number;
  name: string;
  description: string | null;
  type: 'language' | 'user_created';
  access_type: 'open' | 'invite_only';
  language_code: string | null;
  language_name?: string | null;
  language_native_name?: string | null;
  owner_id: number | null;
  owner_username?: string | null;
  member_count: number;
  actual_member_count?: number;
  created_at: string;
  updated_at: string;
  members?: ApiCommunityMember[];
  user_membership?: ApiCommunityMember | null;
}

export interface ApiCommunityMember {
  id: number;
  community_id: number;
  user_id: number;
  username?: string;
  reputation?: number;
  extra?: string | null;
  role: 'creator' | 'moderator' | 'member';
  joined_at: string;
}

export interface ApiCommunityInvitation {
  id: number;
  community_id: number;
  community_name?: string;
  community_description?: string | null;
  community_access_type?: string;
  community_member_count?: number;
  user_id: number;
  invited_by_id: number;
  invited_by_username?: string;
  user_username?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export interface ApiCommunityStats {
  community_id: number;
  community_name: string;
  period: 'week' | 'month' | 'year' | 'all';
  total_translations: number;
  translations_by_status: Record<string, number>;
  translations_by_language: Record<string, number>;
  translations_over_time: Array<{
    date: string;
    count: number;
  }>;
  top_contributors: Array<{
    id: number;
    username: string;
    display_name: string;
    reputation: number;
    translation_count: number;
  }>;
}

export interface ApiCommunityLeaderboard {
  community_id: number;
  community_name: string;
  metric: 'reputation' | 'translations' | 'reviews';
  leaderboard: Array<{
    rank: number;
    id: number;
    username: string;
    display_name: string;
    reputation: number;
    role: 'creator' | 'moderator' | 'member';
    joined_at: string;
    translation_count: number;
    review_count: number;
  }>;
}

export interface ApiAdminActivity {
  id: number;
  user_id: number;
  action: string;
  term_id?: number;
  term_field_id?: number;
  translation_id?: number;
  appeal_id?: number;
  appeal_message_id?: number;
  extra?: {
    target_user_id?: number;
    target_username?: string;
    reason?: string;
    previous_status?: string;
    new_status?: string;
    previous_language?: string;
    new_language?: string;
    goal_id?: number;
    title?: string;
    goal_type?: string;
    updates?: string[];
  };
  created_at: string;
  admin_username: string;
}

// Events & Competitions Types
export interface EventTeam {
  id: string;
  event_id: string;
  name: string;
  image_url?: string;
  join_code: string;
  member_count?: number;
  total_points?: number;
  is_user_member?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  source_id?: number | null;
  source_name?: string | null;
  target_language?: string;
  target_count?: number;
  current_count?: number;
  target_category?: string;
  reward_title?: string;
  is_featured_homepage?: number;
  user_team_id?: string;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  teams?: EventTeam[];
}

export interface UserTitle {
  user_reward_id: string;
  is_equipped: number;
  awarded_at?: string;
  reward_id: string;
  title_name: string;
  event_id?: string;
  event_title?: string;
  event_end_date?: string;
  winning_team_name?: string;
  user_points?: number;
}

// Gacha & Ecosystem Types
export interface VisualTraits {
  primary_color: string;
  secondary_color: string;
  scale: number;
  glow: boolean;
  body_type: string;
}

export interface GachaSpecies {
  id: string;
  name: string;
  depth_zone: 'sunlit' | 'twilight' | 'abyssal';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  drop_weight?: number;
  description: string;
  visual_traits: VisualTraits;
  is_discovered?: boolean;
  caught_count?: number;
  first_caught_at?: string | null;
}

export interface UserEcosystem {
  user_id: number;
  tickets: number;
  food_flakes: number;
  super_pellets: number;
  water_quality: number;
  health_status: 'thriving' | 'stable' | 'distressed' | 'dormant';
  last_fed_at: string;
  last_decay_at: string;
  pity_counter_epic: number;
  pity_counter_legendary: number;
  total_pulls: number;
}

export interface UserFish {
  user_fish_id: number;
  species_id: string;
  name: string;
  nickname?: string | null;
  depth_zone: 'sunlit' | 'twilight' | 'abyssal';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  visual_traits: VisualTraits;
  status: 'active' | 'dormant';
  caught_at: string;
  is_favorite: number;
}

export interface EcosystemResponse {
  ecosystem: UserEcosystem;
  fishes: UserFish[];
}

export interface GachaPullResult {
  user_fish_id: number;
  species_id: string;
  name: string;
  depth_zone: 'sunlit' | 'twilight' | 'abyssal';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  visual_traits: VisualTraits;
  is_new_discovery: boolean;
}

export interface GachaPullResponse {
  results: GachaPullResult[];
  updated_ecosystem: UserEcosystem;
  extra_flakes_awarded: number;
}

export interface CodexResponse {
  species: GachaSpecies[];
  total_species: number;
  total_discovered: number;
  completion_percentage: number;
}

export interface AdminGachaUser {
  id: number;
  username: string;
  is_admin: number;
  is_superadmin: boolean;
  has_gacha_access: number;
  dive_tickets: number;
  tickets?: number;
  food_flakes: number;
  super_pellets: number;
  water_quality: number;
  fishes_count: number;
}

export interface AdminGachaSummary {
  total_users_with_access: number;
  total_tickets_in_circulation: number;
  total_fishes_caught: number;
}

export interface AdminGachaResponse {
  users: AdminGachaUser[];
  summary: AdminGachaSummary;
}
