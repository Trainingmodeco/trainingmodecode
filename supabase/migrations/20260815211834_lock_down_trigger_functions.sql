-- These are TRIGGER functions — they must never be callable as REST RPCs.
-- Postgres grants EXECUTE to PUBLIC by default, which exposed the SECURITY
-- DEFINER new-user handler at /rest/v1/rpc/tm_handle_new_user.
revoke all on function public.tm_handle_new_user() from public, anon, authenticated;
revoke all on function public.tm_touch_updated_at() from public, anon, authenticated;
