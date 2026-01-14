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
