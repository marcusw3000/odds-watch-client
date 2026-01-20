-- Adicionar coluna CPF na tabela profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS cpf text;

-- Criar index único para CPF (não pode haver duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique 
  ON profiles(cpf) WHERE cpf IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário (11 dígitos, obrigatório para cadastro)';

-- Atualizar trigger handle_new_user para incluir cpf e phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cpf, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;