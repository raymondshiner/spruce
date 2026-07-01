import type { ChatTurn } from '@/shared/types/project';
import type { Mode, Plan, FollowupReply } from '@/shared/schema/plan';

export type RegisterRequest = {
  appVersion: string;
};

export type RegisterResponse = {
  deviceId: string;
  deviceSecret: string;
};

export type AreaProjectSummary = {
  title: string;
  vibe: string;
  keyChanges: string[];
  visionSummary?: string;
};

export type AreaContext = {
  areaName: string;
  areaNotes: string;
  siblings: AreaProjectSummary[];
};

export type FollowupImage = {
  base64: string;
  role: 'reference' | 'detail';
};

export type PlanRequest = {
  mode: Mode;
  zone?: string;
  goal: string;
  photoBase64: string;
  openaiApiKey: string;
  areaContext?: AreaContext;
};

export type PlanResponse = Plan;

export type FollowupRequest = {
  mode: Mode;
  zone?: string;
  visionSummary: string;
  plan: Plan;
  turns: ChatTurn[];
  question: string;
  openaiApiKey: string;
  areaContext?: AreaContext;
  images?: FollowupImage[];
};

export type FollowupResponse = FollowupReply;

export type VisualizeRequest = {
  mode: Mode;
  kind: 'render' | 'layout';
  plan: Plan;
  photoBase64?: string; // required when kind === 'render'
  openaiApiKey: string;
};

export type VisualizeResponse = {
  imageBase64: string;
  costEstimateUsd: number;
};

export type ApiErrorKind =
  | 'invalid_key'
  | 'quota_exceeded'
  | 'upstream_unavailable'
  | 'spruce_rate_limit'
  | 'schema_parse_fail'
  | 'auth_failed'
  | 'bad_request'
  | 'network'
  | 'unknown';

export type ApiError = {
  error: ApiErrorKind;
  message?: string;
  retryAfterSeconds?: number;
  upstreamCode?: number;
};
