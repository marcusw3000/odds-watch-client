import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

const emailTemplates: Record<string, (data: any) => { subject: string; html: string }> = {
  MARKET_SETTLED: (data) => ({
    subject: `🎯 Resultado: ${data.market_title || 'Mercado'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>Resultado do Mercado</h2>
        <p style="font-size: 18px;">${data.title || 'Um mercado que você apostou foi liquidado'}</p>
        <p style="color: #666;">${data.message}</p>
        ${data.result ? `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0;">
            <strong>Resultado:</strong> ${data.result}<br>
            ${data.profit ? `<strong>Seu lucro:</strong> R$${data.profit.toFixed(2)}` : ''}
          </div>
        ` : ''}
        <a href="https://predictmarket.com/portfolio" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver meu portfólio
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Você recebeu este email porque está inscrito nas notificações do PredictMarket.
          <a href="https://predictmarket.com/settings/notifications">Gerenciar preferências</a>
        </p>
      </div>
    `,
  }),

  MARKET_CLOSING_SOON: (data) => ({
    subject: `⏰ Mercado fechando: ${data.market_title || 'Atenção'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>⏰ Mercado Fechando em Breve</h2>
        <p style="font-size: 18px;">${data.title}</p>
        <p style="color: #666;">${data.message}</p>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
          <strong>Tempo restante:</strong> ${data.time_remaining || 'Poucas horas'}
        </div>
        <a href="https://predictmarket.com/market/${data.market_id}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver mercado
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Você recebeu este email porque está inscrito nas notificações do PredictMarket.
        </p>
      </div>
    `,
  }),

  WITHDRAWAL_REQUESTED: (data) => ({
    subject: `💸 Saque solicitado: R$${data.amount?.toFixed(2) || '0,00'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>💸 Solicitação de Saque Recebida</h2>
        <p style="color: #666;">Recebemos sua solicitação de saque e ela está sendo processada.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Valor solicitado:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">R$${data.amount?.toFixed(2) || '0,00'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Taxa:</td>
              <td style="padding: 8px 0; text-align: right;">R$${data.fee?.toFixed(2) || '0,00'}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b; font-weight: bold;">Valor a receber:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #22c55e; font-size: 18px;">R$${data.net_amount?.toFixed(2) || '0,00'}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
          <strong>Chave PIX:</strong> ${data.pix_key || 'Não informada'}<br>
          <strong>Tipo:</strong> ${data.pix_key_type || 'Não informado'}
        </div>

        <p style="color: #666;">
          <strong>Prazo de processamento:</strong> até 24 horas úteis.<br>
          Você receberá outro email quando o saque for concluído.
        </p>

        <a href="https://predictmarket.com/portfolio" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver meu portfólio
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Se você não solicitou este saque, entre em contato conosco imediatamente.
        </p>
      </div>
    `,
  }),

  WITHDRAWAL_COMPLETED: (data) => ({
    subject: `✅ Saque concluído: R$${data.net_amount?.toFixed(2) || '0,00'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>✅ Saque Concluído com Sucesso!</h2>
        <p style="color: #666;">Seu saque foi processado e o valor foi transferido para sua conta.</p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: #64748b; margin: 0;">Valor transferido</p>
          <p style="font-size: 32px; font-weight: bold; color: #22c55e; margin: 8px 0;">R$${data.net_amount?.toFixed(2) || '0,00'}</p>
        </div>

        <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0;">
          <strong>Chave PIX:</strong> ${data.pix_key || 'Não informada'}<br>
          <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        <p style="color: #666;">
          O valor deve aparecer em sua conta em alguns minutos. Caso não receba, entre em contato conosco.
        </p>

        <a href="https://predictmarket.com/portfolio" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver histórico
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Obrigado por usar o PredictMarket!
        </p>
      </div>
    `,
  }),

  WITHDRAWAL_FAILED: (data) => ({
    subject: `❌ Problema com seu saque`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>❌ Problema com seu Saque</h2>
        <p style="color: #666;">Infelizmente não foi possível processar seu saque.</p>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #64748b; margin: 0 0 8px 0;">Valor solicitado</p>
          <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 0;">R$${data.amount?.toFixed(2) || '0,00'}</p>
          ${data.error_message ? `<p style="color: #dc2626; margin-top: 12px;"><strong>Motivo:</strong> ${data.error_message}</p>` : ''}
        </div>

        <p style="color: #666;">
          O valor foi estornado para o seu saldo na plataforma. Por favor, verifique os dados da chave PIX e tente novamente.
        </p>

        <a href="https://predictmarket.com/portfolio" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Tentar novamente
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Se precisar de ajuda, entre em contato com nosso suporte.
        </p>
      </div>
    `,
  }),

  USER_WARNING: (data) => ({
    subject: `⚠️ Advertência: Seu comentário foi reportado`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>⚠️ Advertência Recebida</h2>
        <p style="color: #666;">Seu comentário foi reportado pela comunidade e revisado pela nossa equipe de moderação.</p>
        
        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0;"><strong>Motivo:</strong> ${data.reason_label || 'Violação das diretrizes da comunidade'}</p>
          ${data.comment_preview ? `<p style="color: #78716c; margin-top: 12px; font-style: italic;">"${data.comment_preview}..."</p>` : ''}
        </div>

        <p style="color: #666;">
          <strong>O que isso significa:</strong><br>
          Esta é uma advertência formal. Múltiplas advertências podem resultar em restrições na sua conta.
        </p>

        <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0;">
          <strong>Diretrizes da Comunidade:</strong>
          <ul style="color: #64748b; margin: 8px 0; padding-left: 20px;">
            <li>Mantenha o respeito com outros usuários</li>
            <li>Evite spam ou conteúdo repetitivo</li>
            <li>Não compartilhe informações falsas</li>
            <li>Contribua de forma construtiva para as discussões</li>
          </ul>
        </div>

        <a href="https://predictmarket.com/settings" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver minhas configurações
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Se você acredita que esta advertência foi um erro, entre em contato com nosso suporte.
        </p>
      </div>
    `,
  }),

  SUPPORT_REPLY: (data) => ({
    subject: `📩 Nova resposta no seu ticket: ${data.subject || 'Suporte'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>📩 Nova Resposta no Suporte</h2>
        <p style="color: #666;">Nossa equipe respondeu ao seu ticket de suporte.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #64748b; margin: 0 0 8px 0;"><strong>Assunto:</strong> ${data.subject || 'Suporte'}</p>
          ${data.message_preview ? `<p style="color: #334155; margin: 0; font-style: italic;">"${data.message_preview}..."</p>` : ''}
        </div>

        <a href="https://predictmarket.com/settings?tab=support&ticket=${data.ticket_id || ''}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver resposta completa
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Você recebeu este email porque abriu um ticket de suporte no PredictMarket.
        </p>
      </div>
    `,
  }),

  SUPPORT_TICKET_RESOLVED: (data) => ({
    subject: `✅ Ticket resolvido: ${data.subject || 'Suporte'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>✅ Ticket Resolvido</h2>
        <p style="color: #666;">Seu ticket de suporte foi marcado como resolvido.</p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #166534; margin: 0;"><strong>Assunto:</strong> ${data.subject || 'Suporte'}</p>
          <p style="color: #22c55e; margin: 8px 0 0 0; font-weight: bold;">Status: Resolvido ✓</p>
        </div>

        <p style="color: #666;">
          Se você ainda tiver dúvidas ou o problema persistir, você pode reabrir o ticket ou criar um novo.
        </p>

        <a href="https://predictmarket.com/settings?tab=support" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Ver meus tickets
        </a>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Obrigado por entrar em contato! Esperamos ter ajudado.
        </p>
      </div>
    `,
  }),

  DEFAULT: (data) => ({
    subject: data.title || 'Notificação do PredictMarket',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6366f1;">PredictMarket</h1>
        <h2>${data.title}</h2>
        <p style="color: #666;">${data.message}</p>
        <a href="https://predictmarket.com" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
          Acessar plataforma
        </a>
      </div>
    `,
  }),
};

async function sendResendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PredictMarket <notifications@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, type, title, message, data }: NotificationEmailRequest = await req.json();

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error("User email not found:", profileError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .single();

    // Check if email is enabled for this type
    const shouldSendEmail = () => {
      if (!prefs) return true; // Default: send emails
      
      switch (type) {
        case "MARKET_SETTLED":
          return prefs.email_market_settled;
        case "MARKET_CLOSING_SOON":
          return prefs.email_market_closing;
        default:
          return true;
      }
    };

    if (!shouldSendEmail()) {
      return new Response(
        JSON.stringify({ message: "Email disabled by user preferences" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email template
    const templateFn = emailTemplates[type] || emailTemplates.DEFAULT;
    const { subject, html } = templateFn({ title, message, ...data });

    // Send email via Resend API
    const emailResponse = await sendResendEmail(profile.email, subject, html);

    console.log("Email sent successfully:", emailResponse);

    // Update notification as email_sent
    if (data?.notification_id) {
      await supabase
        .from("notifications")
        .update({ email_sent: true })
        .eq("id", data.notification_id);
    }

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
