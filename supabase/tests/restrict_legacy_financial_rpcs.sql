DO $$ DECLARE fn regprocedure; BEGIN
  FOREACH fn IN ARRAY ARRAY['public.atomic_deposit_balance(uuid,numeric)'::regprocedure,
    'public.atomic_withdraw_balance(uuid,numeric)'::regprocedure,
    'public.check_pending_withdrawal(uuid,numeric,text)'::regprocedure,
    'public.notify_admins(text,text,text,jsonb)'::regprocedure] LOOP
    IF has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE') THEN RAISE EXCEPTION 'Client can execute %',fn; END IF;
    IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'Service cannot execute %',fn; END IF;
  END LOOP;
END $$;
