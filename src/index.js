/**
 * Longhorn Shield — Cloudflare Worker
 *
 * Static pages in /public are served directly by Cloudflare's edge.
 * This script only runs for /api/* (see run_worker_first in wrangler.jsonc).
 *
 * Environment values it looks for:
 *   NOTIFY_TO             where quote requests are emailed        (var)
 *   NOTIFY_FROM           the from address on those emails        (var)
 *   TURNSTILE_SECRET_KEY  enables bot checking when present       (secret)
 *   RESEND_API_KEY        used if the EMAIL binding is absent     (secret)
 *   EMAIL                 Cloudflare Email Sending binding        (optional)
 *   LEADS                 KV namespace, keeps a copy of each lead (optional)
 */

const COVERAGE = ["Auto", "Home", "Commercial", "More than one"];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/quote") {
            if (request.method !== "POST") {
                return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
            }
            try {
                return await handleQuote(request, env);
            } catch (err) {
                console.error("quote handler failed", err);
                return respond(request, { error: "We could not send that just now." }, 500);
            }
        }

        // Anything else: hand back to the static assets.
        return env.ASSETS.fetch(request);
    }
};

async function handleQuote(request, env) {
    const fields = await readFields(request);

    // Honeypot. Bots fill hidden inputs; people never see them.
    if (fields.company_website) {
        return respond(request, { ok: true }, 200);
    }

    const errors = validate(fields);
    if (errors) return respond(request, { error: errors }, 400);

    if (env.TURNSTILE_SECRET_KEY) {
        const passed = await verifyTurnstile(
            fields["cf-turnstile-response"],
            env.TURNSTILE_SECRET_KEY,
            request.headers.get("CF-Connecting-IP")
        );
        if (!passed) {
            return respond(request, { error: "The bot check did not pass. Please try again." }, 400);
        }
    }

    const lead = {
        receivedAt: new Date().toISOString(),
        coverage: fields.coverage,
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        zip: fields.zip.trim(),
        carrier: (fields.carrier || "").trim(),
        renewal: (fields.renewal || "").trim(),
        details: (fields.details || "").trim(),
        consent: fields.consent === "yes",
        country: request.headers.get("CF-IPCountry") || "",
        userAgent: request.headers.get("User-Agent") || ""
    };

    await sendNotification(lead, env);

    if (env.LEADS) {
        // Keeps a copy for 400 days in case email delivery ever fails silently.
        await env.LEADS.put(`lead:${lead.receivedAt}:${crypto.randomUUID()}`, JSON.stringify(lead), {
            expirationTtl: 60 * 60 * 24 * 400
        });
    }

    return respond(request, { ok: true }, 200);
}

async function readFields(request) {
    const type = request.headers.get("Content-Type") || "";
    if (type.includes("application/json")) {
        const body = await request.json();
        return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v == null ? "" : String(v)]));
    }
    const form = await request.formData();
    const out = {};
    for (const [key, value] of form.entries()) out[key] = typeof value === "string" ? value : "";
    return out;
}

function validate(f) {
    if (!COVERAGE.includes(f.coverage)) return "Choose what you need covered.";
    if (!f.name || f.name.trim().length < 2) return "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((f.email || "").trim())) return "Enter a valid email address.";
    if ((f.phone || "").replace(/\D/g, "").length < 10) return "Enter a 10-digit phone number.";
    if (!/^\d{5}$/.test((f.zip || "").trim())) return "Enter a 5-digit ZIP code.";
    if (f.consent !== "yes") return "Tick the consent box so we are allowed to contact you.";
    if ((f.details || "").length > 4000) return "That message is too long. Please shorten it.";
    return null;
}

async function verifyTurnstile(token, secret, ip) {
    if (!token) return false;
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body
    });
    const data = await res.json();
    return data.success === true;
}

async function sendNotification(lead, env) {
    const to = env.NOTIFY_TO || "quotes@longhornshield.org";
    const from = env.NOTIFY_FROM || "website@longhornshield.org";
    const subject = `${lead.coverage} quote request — ${lead.name} (${lead.zip})`;

    const rows = [
        ["Coverage", lead.coverage],
        ["Name", lead.name],
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["ZIP", lead.zip],
        ["Current carrier", lead.carrier || "—"],
        ["Renewal date", lead.renewal || "—"],
        ["Consent to contact", lead.consent ? "Yes" : "No"],
        ["Received", lead.receivedAt]
    ];

    const text =
        rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
        `\n\nDetails:\n${lead.details || "(none provided)"}\n`;

    const html =
        `<h2 style="font-family:Georgia,serif">${escapeHtml(lead.coverage)} quote request</h2>` +
        '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">' +
        rows
            .map(
                ([k, v]) =>
                    `<tr><td style="color:#666">${escapeHtml(k)}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>`
            )
            .join("") +
        "</table>" +
        `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(
            lead.details || "(none provided)"
        )}</p>`;

    // Preferred: Cloudflare Email Sending binding (Workers Paid plan).
    if (env.EMAIL) {
        await env.EMAIL.send({ from, to, replyTo: lead.email, subject, text, html });
        return;
    }

    // Fallback: Resend over HTTPS. Works on the free Workers plan.
    if (env.RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ from, to: [to], reply_to: lead.email, subject, text, html })
        });
        if (!res.ok) {
            throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
        }
        return;
    }

    // Nothing configured. Don't lose the lead — log it and keep going.
    console.log("No email provider configured. Lead:", JSON.stringify(lead));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

/** JSON for fetch callers, a redirect for plain form posts (no-JS fallback). */
function respond(request, payload, statusCode) {
    const accept = request.headers.get("Accept") || "";
    const wantsJson =
        accept.includes("application/json") || (request.headers.get("Content-Type") || "").includes("application/json");

    if (wantsJson) return json(payload, statusCode);

    if (payload.ok) {
        return new Response(null, { status: 303, headers: { Location: "/thanks.html" } });
    }
    return new Response(
        `<!DOCTYPE html><meta charset="utf-8"><title>Could not send</title>` +
        `<body style="font-family:system-ui;max-width:38rem;margin:4rem auto;padding:0 1rem">` +
        `<h1 style="font-size:1.5rem">We could not send that</h1><p>${escapeHtml(payload.error)}</p>` +
        `<p><a href="/quote.html">Go back to the form</a> or call (512) 555-0100.</p>`,
        { status: statusCode, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
}

function json(payload, statusCode, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status: statusCode,
        headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
    });
}
