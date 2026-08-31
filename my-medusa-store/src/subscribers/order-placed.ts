import { type SubscriberConfig, type SubscriberArgs } from "@medusajs/framework"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")

  // Fetch the order with its shipping address, customer email, and items
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "email",
      "currency_code",
      "total",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.address_1",
      "shipping_address.city",
      "shipping_address.country_code",
      "shipping_address.phone",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "items.metadata"
    ],
    filters: {
      id: data.id,
    },
  })

  const order = orders[0]

  const shortId = order.id.split('_')[1] || order.id;
  const firstName = order.shipping_address?.first_name || 'Klient';
  const lastName = order.shipping_address?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const addressLine = order.shipping_address?.address_1 || '';
  const city = order.shipping_address?.city || '';
  const cCode = order.shipping_address?.country_code || 'xk';
  const country = cCode === 'xk' ? 'Kosovë' : (cCode === 'al' ? 'Shqipëri' : 'Maqedoni e Veriut');
  const phone = order.shipping_address?.phone || '';

  // Calculate pricing manually (use fallback qty from metadata if normal quantity is missing)
  const subtotal = order.items?.reduce((sum: number, item: any) => {
    const qty = item?.quantity || item?.metadata?.qty || 1;
    return sum + (Number(item?.unit_price) * Number(qty));
  }, 0) || 0;

  let transporti = 1.80;
  if (cCode === 'al') transporti = 4.80;
  else if (cCode === 'mk') transporti = 5.80;
  else if (cCode === 'ch' || cCode === 'de') transporti = 15.00;

  const finalTotal = subtotal + transporti;

  // User requested dark green matching the 4th image (Deep Forest Green / Teal)
  const BRAND_COLOR = "#052F2D";

  // Create HTML email body mimicking the GjirafaMall style with Dark Green
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      .dark-mode-bg {
        background-color: ${BRAND_COLOR} !important;
        background-image: linear-gradient(${BRAND_COLOR}, ${BRAND_COLOR}) !important;
      }
      .dark-mode-text {
        background-image: linear-gradient(#ffffff, #ffffff) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f7;">
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #333; background: #fff;">
      
      <!-- Header / Logo -->
      <div style="text-align: center; padding: 20px 0;">
        <img src="https://iili.io/qAgqQMG.png" alt="Bukur Logo" style="width: 220px; height: auto;" />
      </div>

      <!-- Greeting block -->
      <div style="padding: 20px; background: #fdfdfd; border-top: 1px solid #eee;">
        <p style="margin: 0 0 10px 0; font-size: 15px;">Tung ${firstName},</p>
        <p style="margin: 0 0 15px 0; font-size: 15px;">Ju falënderojmë që zgjodhët BUKUR!</p>
        <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: bold;">Porosinë tuaj e kemi pranuar!</p>
        <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5; color: #555;">Pasi të bëhet konfirmimi i inventarit të produktit dhe i informatave të nevojshme, porosia do të përgatitet për dërgesë sa më shpejt të jetë e mundur.</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #555;">Në disa raste mund të kontaktoheni nga ekipi ynë për konfirmim të porosisë gjatë orarit 08:00 – 20:00.</p>
        <p style="margin: 0 0 5px 0; font-size: 15px;">Shumë dashuri,</p>
        <p style="margin: 0; font-size: 15px;">BUKUR TEAM</p>
      </div>

      <!-- Order ID Bar -->
      <div style="text-align: center; padding: 15px; border-top: 1px solid #eee; border-bottom: 1px solid #eee; background: #fff; font-size: 14px;">
        Numri i porosisë: <strong>#${shortId}</strong>
      </div>

      <!-- Order Status Confirmed (Hero Redesign with BUKUR Logo) -->
      <div class="dark-mode-bg" style="padding: 25px 20px; text-align: center; background-color: ${BRAND_COLOR}; background-image: linear-gradient(${BRAND_COLOR}, ${BRAND_COLOR});">
        <div style="margin: 0 auto 15px;">
          <!-- Using the provided Bukur logo -->
          <img src="https://iili.io/qAgqQMG.png" alt="Bukur Logo" style="width: 100px; height: auto;" />
        </div>
        <h2 class="dark-mode-text" style="margin: 0 0 10px 0; color: #ffffff !important; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Faleminderit!</h2>
        <h3 class="dark-mode-text" style="margin: 0; color: #ffffff !important; font-size: 18px; font-weight: 500;">Porosia juaj u konfirmua me sukses.</h3>
        <p class="dark-mode-text" style="margin: 10px 0 0 0; color: #ffffff !important; font-size: 14px;">Shumë shpejt do t'ju kontaktojmë për kohën e dorëzimit.</p>
      </div>

      <!-- Products Table -->
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr>
              <th style="text-align: left; padding-bottom: 15px; border-bottom: 1px solid #eee; font-weight: bold;">Produktet</th>
              <th style="text-align: right; padding-bottom: 15px; border-bottom: 1px solid #eee; font-weight: bold;">Çmimi</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map((item: any) => {
    const qty = item?.quantity || item?.metadata?.qty || 1;
    return `
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #eee;">
                    <div style="color: #333; margin-bottom: 4px; font-size: 15px; font-weight: 500;">${item?.title}</div>
                    <div style="color: #666; font-size: 13px;">Sasia: ${qty}</div>
                  </td>
                  <td style="padding: 15px 0; border-bottom: 1px solid #eee; text-align: right; vertical-align: top; color: #333; font-weight: bold;">
                    ${Number(item?.unit_price).toFixed(2)} €
                  </td>
                </tr>
              `}).join('')}
          </tbody>
        </table>

        <!-- Totals Layout (100% width to span edges) -->
        <div style="width: 100%; margin-top: 15px;">
          <table style="width: 100%; font-size: 13px; color: #333;">
            <tr>
              <td style="padding: 5px 0; text-align: left;">Nëntotali:</td>
              <td style="padding: 5px 0; text-align: right; font-weight: bold;">${subtotal.toFixed(2)} €</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; text-align: left;">Transporti:</td>
              <td style="padding: 5px 0; text-align: right; font-weight: bold;">${transporti.toFixed(2)} €</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; text-align: left; border-top: 1px solid #eee; margin-top: 5px;">Totali i porosisë:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: bold; color: ${BRAND_COLOR}; border-top: 1px solid #eee; margin-top: 5px;">${finalTotal.toFixed(2)} €</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Addresses Section -->
      <div style="padding: 20px; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
        <table style="width: 100%; font-size: 13px; color: #555; line-height: 1.6;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 10px;">
              <strong style="color: #333; display: block; margin-bottom: 8px;">Adresa e Transportit</strong>
              ${fullName}<br/>
              ${addressLine}<br/>
              ${city}, ${country}<br/>
              <a href="mailto:${order.email}" style="color: #0066cc; text-decoration: none;">${order.email}</a><br/>
              ${phone}
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 10px; text-align: right;">
              <strong style="color: #333; display: block; margin-bottom: 8px;">Adresa e Faturimit</strong>
              ${fullName}<br/>
              ${addressLine}<br/>
              ${city}, ${country}<br/>
              <a href="mailto:${order.email}" style="color: #0066cc; text-decoration: none;">${order.email}</a><br/>
              ${phone}
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment Method -->
      <div style="padding: 20px; font-size: 15px; text-align: center; color: #555; background: #f8fafc; border-bottom: 1px solid #eee;">
        Mënyra e pagesës: <span style="font-weight: bold; color: ${BRAND_COLOR}; text-transform: uppercase;">${order.metadata?.payment_method === 'card' ? 'PAGUAJ ME KARTELË BANKARE' : 'PAGUAJ ME PARA NË DORË'}</span>
      </div>

    </div>
</body>
</html>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Bukur <onboarding@resend.dev>",
      to: order.email,
      subject: `Order Confirmation - ${order.id}`,
      html: emailHtml,
    })
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("Failed to send order email via Resend:", err)
  } else {
    console.log(`Order confirmation email sent successfully to ${order.email}!`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
