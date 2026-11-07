-- Fixture for checking preservation of pre-existing positions in the isolated database.
INSERT INTO auth.users(id) VALUES ('f30fa7a3-40b1-4bf1-b0c4-7bf2482a4f41');
INSERT INTO public.polymarket_paper_wallets(user_id,balance_usd) VALUES ('f30fa7a3-40b1-4bf1-b0c4-7bf2482a4f41',9000);
INSERT INTO public.polymarket_paper_positions(user_id,market_id,market_question,outcome_label,outcome_token_id,shares,average_price)
VALUES ('f30fa7a3-40b1-4bf1-b0c4-7bf2482a4f41','111','Legacy','Yes','123',10,0.2);
