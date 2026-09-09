-- Run this once in the Supabase SQL editor.
-- Atomically checks AND debits balance in a single statement, so two
-- simultaneous withdrawal requests can't both pass the balance check.
-- Returns the updated row if successful, or zero rows if balance was insufficient.

CREATE OR REPLACE FUNCTION public.debit_wallet_atomic(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS TABLE (
    balance_before NUMERIC,
    balance_after NUMERIC
) AS $$
DECLARE
    v_before NUMERIC;
BEGIN
    -- Row-level lock prevents a concurrent request from reading a stale balance
    SELECT available_balance INTO v_before
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_before IS NULL OR v_before < p_amount THEN
        RETURN; -- returns zero rows, caller checks for this
    END IF;

    UPDATE public.wallets
    SET available_balance = available_balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT v_before, v_before - p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Companion function to refund a wallet if a transfer fails after being debited.
CREATE OR REPLACE FUNCTION public.refund_wallet_atomic(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.wallets
    SET available_balance = available_balance + p_amount,
        total_withdrawn = total_withdrawn - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
