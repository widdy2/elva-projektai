import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { quote_id, app_url } = await req.json()
    if (!quote_id) {
      throw new Error('Trūksta quote_id')
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      throw new Error('RESEND_API_KEY nenustatytas Supabase secrets')
    }

    // Service role klientas — gali skaityti bet ką
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pasiūlymas + organizacija
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, organizations(name, email, phone, brand_color)')
      .eq('id', quote_id)
      .single()

    if (quoteError || !quote) {
      throw new Error(`Pasiūlymas nerastas: ${quoteError?.message || 'nežinoma'}`)
    }

    const clientEmail = quote.client_email
    if (!clientEmail) {
      throw new Error('Pasiūlyme nėra kliento el. pašto')
    }

    const baseUrl = app_url || Deno.env.get('APP_URL') || ''
    const quoteUrl = `${baseUrl}/quote/${quote.public_token}`
    const org = quote.organizations || {}
    const brandColor = org.brand_color || '#3b82f6'
    const orgName = org.name || 'Įmonė'

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${brandColor}; height: 6px;"></div>
        <div style="padding: 24px;">
          <h2 style="color: #111; margin: 0 0 8px;">${orgName}</h2>
          <p style="color: #555; margin: 0 0 24px;">Atsiuntėme jums darbų pasiūlymą.</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: #777;">Objektas:</td>
              <td style="padding: 8px 0; color: #111; text-align: right;">${quote.address || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #777; border-top: 1px solid #eee;">Suma su PVM:</td>
              <td style="padding: 8px 0; color: #111; text-align: right; border-top: 1px solid #eee; font-weight: bold;">€${(quote.total || 0).toFixed(2)}</td>
            </tr>
          </table>

          <a href="${quoteUrl}" style="display: inline-block; background: ${brandColor}; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold;">
            Peržiūrėti pasiūlymą
          </a>

          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            Jei mygtukas neveikia, atidarykite šią nuorodą: <a href="${quoteUrl}" style="color: ${brandColor};">${quoteUrl}</a>
          </p>
          ${org.phone || org.email ? `<p style="color: #999; font-size: 12px;">${[org.phone, org.email].filter(Boolean).join(' | ')}</p>` : ''}
        </div>
      </div>
    `

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'Pasiūlymai <onboarding@resend.dev>',
        to: [clientEmail],
        subject: `Darbų pasiūlymas — ${orgName}`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      throw new Error(`Resend klaida: ${resendRes.status} ${errBody}`)
    }

    // Pažymime pasiūlymą kaip išsiųstą
    await supabase
      .from('quotes')
      .update({ status: 'sent' })
      .eq('id', quote_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
