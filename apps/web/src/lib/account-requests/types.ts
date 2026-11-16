export type AccountRequest = {
  id: string;
  full_name: string;
  email: string;
  email_normalized: string;
  phone: string | null;
  phone_normalized: string | null;
  business_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  invite_sent_at: string | null;
  auth_user_id: string | null;
  rejection_reason: string | null;
  review_started_at: string | null;
};

export type AccountRequestActionState = {
  error?: string;
  success?: string;
  values?: { full_name: string; email: string; phone: string; business_name: string };
};
