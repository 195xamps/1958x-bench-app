export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  totalTokensUsed: number | null;
  tokenQuota: number | null;
  chatCount: number;
  jobCount: number;
  isActive: boolean;
}

export interface AdminChat {
  id: string;
  userId: string | null;
  title: string;
  benchJobId: string | null;
  isStandalone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  totalTokens: number;
  estimatedCostUsd: number;
  totalAssistantMessages: number;
  breakdown: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    tokens: number;
    estimatedCostUsd: number;
  }[];
}

export interface AdminJob {
  job: {
    id: string;
    userId: string | null;
    status: string;
    ownerSymptoms: string | null;
    techNotes: string | null;
    createdAt: string;
  };
  ampProfile: {
    make: string | null;
    model: string | null;
    year: string | null;
    circuitFamily: string | null;
  } | null;
  user?: AdminUser;
}
