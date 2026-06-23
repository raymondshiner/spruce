import type { ChatTurn } from '@/shared/types/project';
import type { Mode, Plan, FollowupReply } from '@/shared/schema/plan';

export type RegisterRequest = {
  appVersion: string;
};

export type RegisterResponse = {
  deviceId: string;
  deviceSecret: string;
};

export type PlanRequest = {
  mode: Mode;
  zone?: string;
  goal: string;
  photoBase64: string;
  openaiApiKey: string;
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
};

export type FollowupResponse = FollowupReply;

export type VisualizeRequest = {
  mode: Mode;
  plan: Plan;
  photoBase64: string;
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
