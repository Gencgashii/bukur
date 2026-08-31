import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type OrderItem = {
  name?: string
  price?: number
  quantity?: number
  size?: string
}

type OrderRequest = {
  customerName?: string
  customerEmail?: string
  phone?: string
  paymentMethod?: string
  shippingAddress?: { address?: string; city?: string; state?: string; postalCode?: string }
  items?: OrderItem[]
  total?: number
}

const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character] || character))

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.status(200).json({ ok: true })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const order = req.body as OrderRequest

  if (!order.customerEmail || !order.customerName || !Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ message: "Order details are incomplete." })
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ message: "Order email service is not configured.", emailSent: false })
  }

  const orderNumber = `BK-${Date.now().toString().slice(-8)}`
  const currency = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })
  const itemsHtml = order.items.map((item) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e7e1d9;color:#1a1816;">
        <strong>${escapeHtml(item.name || "BUKUR item")}</strong><br />
        <span style="color:#6d6861;font-size:12px;">Size ${escapeHtml(item.size || "—")} · Qty ${item.quantity || 1}</span>
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #e7e1d9;text-align:right;color:#1a1816;">
        ${currency.format((item.price || 0) * (item.quantity || 1))}
      </td>
    </tr>`).join("")

  const html = `<!doctype html><html><body style="margin:0;background:#f5f2ed;color:#1a1816;font-family:Arial,sans-serif;">
    <main style="max-width:620px;margin:0 auto;background:#fff;padding:48px 34px;">
      <p style="margin:0 0 36px;font-family:Georgia,serif;font-size:34px;letter-spacing:9px;text-align:center;">BUKUR</p>
      <p style="font-size:11px;letter-spacing:2px;text-align:center;color:#716c65;">ORDER CONFIRMATION · ${orderNumber}</p>
      <h1 style="margin:30px 0 14px;font-family:Georgia,serif;font-weight:400;font-size:34px;text-align:center;">Thank you, ${escapeHtml(order.customerName)}.</h1>
      <p style="margin:0 0 32px;line-height:1.7;text-align:center;color:#625e58;">We have received your order and will prepare it with care.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemsHtml}</table>
      <div style="display:flex;justify-content:space-between;padding:22px 0;border-bottom:1px solid #1a1816;font-size:15px;"><strong>Total</strong><strong>${currency.format(order.total || 0)}</strong></div>
      <p style="margin:32px 0 0;font-size:13px;line-height:1.7;color:#625e58;">Delivery to: ${escapeHtml(order.shippingAddress?.address || "")} ${escapeHtml(order.shippingAddress?.city || "")} ${escapeHtml(order.shippingAddress?.state || "")}</p>
      <p style="margin:34px 0 0;text-align:center;font-size:11px;letter-spacing:2px;color:#716c65;">BUKUR · PRISHTINA, KOSOVO</p>
    </main></body></html>`

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "BUKUR <onboarding@resend.dev>",
        to: order.customerEmail,
        subject: `BUKUR order confirmation · ${orderNumber}`,
        html,
      }),
    })

    if (!resendResponse.ok) {
      console.error("Resend email error:", await resendResponse.text())
      return res.status(502).json({ message: "We could not send the order email.", emailSent: false })
    }

    return res.status(201).json({ id: orderNumber, emailSent: true })
  } catch (error) {
    console.error("Order email error:", error)
    return res.status(502).json({ message: "We could not send the order email.", emailSent: false })
  }
}
