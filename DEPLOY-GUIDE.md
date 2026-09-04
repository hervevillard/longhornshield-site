# Longhorn Shield — build and deploy guide

Everything here assumes you have never used Cloudflare before. Read section 1, then pick **one** of the three deployment routes in section 4.

---

## 1. What Cloudflare actually is, in the parts you'll touch

Cloudflare is several separate products under one dashboard. You only need five of them.

| Product | What it does for you | Cost |
|---|---|---|
| **Registrar** | Where `longhornshield.org` is registered. Optional — you can leave the domain wherever it is now. | At cost, roughly $10–12/year for `.org` |
| **DNS** | The phone book that points `longhornshield.org` at your site and your email. Required. | Free |
| **Workers** | Where the site lives. It serves your HTML/CSS/images from data centres worldwide, and runs the small bit of code that handles the quote form. | Free tier is plenty |
| **Turnstile** | A CAPTCHA replacement that stops bots submitting your form. Usually invisible to real people. | Free |
| **Email Routing** | Forwards `quotes@longhornshield.org` to your real inbox (Gmail, Outlook, whatever). | Free |

One naming note that will otherwise confuse you: **Cloudflare Pages** is the older product for static sites, and most tutorials you'll find online use it. It still works, but Cloudflare now recommends **Workers with static assets** for new projects because the site and its form-handling code live in one deployment instead of two. This project is built for Workers. If you land on a Pages tutorial, you're not doing it wrong — it's just the older path.

---

## 2. What's in this folder

```
longhornshield/
├── public/                  ← the website itself (everything here is public)
│   ├── index.html           homepage
│   ├── auto.html            auto coverage
│   ├── home-insurance.html  home coverage
│   ├── commercial.html      commercial coverage
│   ├── quote.html           the form / contact page
│   ├── thanks.html          shown after a successful submission
│   ├── privacy.html         privacy notice (template — have it reviewed)
│   ├── 404.html             shown for bad URLs
│   ├── styles.css           all styling
│   ├── app.js               form validation
│   ├── favicon.svg          browser tab icon
│   ├── _headers             security headers
│   ├── robots.txt
│   └── sitemap.xml
├── src/index.js             the Worker: receives the form, emails it to you
├── wrangler.jsonc           Cloudflare configuration
├── package.json
├── .dev.vars.example        template for local secrets
└── DEPLOY-GUIDE.md          this file
```

You can open `public/index.html` in a browser right now to see the site. The form won't submit until it's deployed.

---

## 3. Before you deploy: replace the placeholders

Everything below is fake and appears on every page. Do a find-and-replace across the whole folder.

| Find | Replace with | Where |
|---|---|---|
| `(512) 555-0100` | your real phone number | all HTML files, `src/index.js` |
| `+15125550100` | same number, digits only, `+1` prefix | all HTML files (the `tel:` links) |
| `quotes@longhornshield.org` | the address you want quote requests sent to | HTML files, `wrangler.jsonc` |
| `617 Pollyann Trl, Haslet, TX 76052` | your business address | footer of every HTML file |
| `Texas license #3477718` | your TDI agency license number | footer of every HTML file |
| `Longhorn Shield LLC` | your exact registered entity name | footer of every HTML file |
| `Monday to Friday, 8:30am–5:30pm Central` | your real hours | footer, `quote.html` |
| `PASTE_TURNSTILE_SITE_KEY` | your Turnstile site key (section 7) | `quote.html` |

On macOS or Linux you can do the phone number in one command from inside the folder:

```bash
grep -rl "555-0100" public src | xargs sed -i '' 's/(512) 555-0100/(512) 867-5309/g'   # macOS
grep -rl "555-0100" public src | xargs sed -i    's/(512) 555-0100/(512) 867-5309/g'   # Linux
```

---

## 4. Deploying — pick one route

### Route A — dashboard only, no software to install

Fastest, but the built-in form handler won't run, because uploading through the dashboard gives you static files with no Worker code behind them. You'd point the form at a hosted form service instead. Good if you want the site live today and will sort the form out later.

1. Sign up at `dash.cloudflare.com`.
2. In the sidebar: **Compute (Workers)** → **Create** → **Upload assets**.
3. Name it `longhornshield`, drag the **contents of the `public` folder** in (not the folder itself), and deploy.
4. You now have a live site at `longhornshield.<something>.workers.dev`.
5. Make the form work: create a free account at Formspree or Web3Forms, and in `quote.html` change

   ```html
   <form class="form" id="quote-form" method="post" action="/api/quote" novalidate>
   ```

   to their endpoint URL, e.g. `action="https://formspree.io/f/YOUR_ID"`. Then delete `<script src="/app.js" defer></script>` from `quote.html` so the browser posts the form normally. Re-upload.
6. Jump to section 5 to attach your domain.

### Route B — GitHub, deploys on every push (recommended)

Best long-term. You edit a file, commit, and Cloudflare rebuilds automatically. No terminal needed after setup.

1. Create an empty repository on GitHub, e.g. `longhornshield-site`.
2. Upload this whole folder to it. GitHub's web UI can do this: **Add file** → **Upload files** → drag everything in. (Do not upload `node_modules` if it exists.)
3. In Cloudflare: **Compute (Workers)** → **Create** → **Import a repository**.
4. Authorise GitHub, pick the repo.
5. Build settings:
   - Build command: **leave empty** (there's nothing to compile)
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
6. **Create and deploy.** Two minutes later it's live.
7. From now on, every push to your main branch redeploys. Pull requests get their own preview URL.

### Route C — from your own machine with the command line

Most control, useful for testing locally before anything goes public.

1. Install Node.js 20 or newer from `nodejs.org`.
2. In a terminal, `cd` into this folder and run:

   ```bash
   npm install
   npx wrangler login          # opens a browser to authorise
   npx wrangler dev            # local preview at http://localhost:8787
   npx wrangler deploy         # publishes it
   ```

`wrangler dev` runs the real Worker locally, so you can submit the form and watch what happens. `wrangler tail` streams live logs from the deployed version.

---

## 5. Pointing longhornshield.org at the site

Your site is live on a `.workers.dev` address at this point. To use the real domain, the domain has to be managed by Cloudflare DNS. Two ways to get there:

**If the domain is registered somewhere else (GoDaddy, Namecheap, Google Domains…)** — you keep it there and just change where DNS is answered from:

1. Cloudflare dashboard → **Add a domain** → enter `longhornshield.org` → choose the **Free** plan.
2. Cloudflare shows you two nameservers, something like `nina.ns.cloudflare.com` and `rick.ns.cloudflare.com`.
3. Log in to your current registrar, find the nameserver settings, and replace what's there with those two.
4. Wait. Usually under an hour, occasionally up to 24. Cloudflare emails you when it's active.

**Or transfer the domain to Cloudflare Registrar** — same nameserver step, plus the registration moves. Cloudflare sells domains at wholesale with no markup, which is normally cheaper than wherever it is now. Domains can't be transferred within 60 days of registration or a previous transfer.

**Then attach the domain to the Worker:**

1. **Compute (Workers)** → `longhornshield` → **Settings** → **Domains & Routes** → **Add** → **Custom domain**.
2. Add `longhornshield.org`. Add `www.longhornshield.org` too.
3. Cloudflare creates the DNS records and issues the HTTPS certificate itself. Nothing to configure, no certificate to buy.

To make `www` redirect to the bare domain: **Rules** → **Redirect Rules** → create one from `www.longhornshield.org/*` to `https://longhornshield.org/$1`, 301 permanent.

---

## 6. Email — receiving and sending

Two different problems that people conflate.

### Receiving mail at quotes@longhornshield.org

**Email → Email Routing** in the dashboard. Add your real inbox as a destination address, confirm the verification email, then create a rule: `quotes@longhornshield.org` → your inbox. Add a catch-all rule too, so nothing sent to a typo'd address vanishes. This is free and takes five minutes.

Note that Email Routing only *forwards*. Replies will come from your personal address unless you also set up sending. If you want a proper mailbox with `@longhornshield.org` on outgoing mail, that's Google Workspace or Microsoft 365 (paid), and you'd add their MX records to Cloudflare DNS instead of using Email Routing.

### Sending the form notifications to you

The Worker needs some way to send email. It supports two, and checks for them in this order:

**Option 1 — Resend (free, works on the free Workers plan).** Resend's free tier covers 3,000 emails a month, 100 a day, which is far more than a quote form generates.

1. Sign up at `resend.com`, add `longhornshield.org` as a domain.
2. Resend gives you DNS records (SPF, DKIM). Add each one in Cloudflare: **DNS** → **Records** → **Add record**. Copy the type, name, and value exactly.
3. Wait for Resend to show the domain as verified, then create an API key.
4. Store the key as a secret:

   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```

   Or in the dashboard: Worker → **Settings** → **Variables and Secrets** → add `RESEND_API_KEY`, type Secret.

**Option 2 — Cloudflare Email Sending.** Native, no third party, but it needs the Workers Paid plan at $5/month. It went into public beta in April 2026.

1. **Compute** → **Email Service** → **Email Sending** → **Onboard domain**, pick `longhornshield.org`.
2. Uncomment this line in `wrangler.jsonc`:

   ```jsonc
   "send_email": [{ "name": "EMAIL" }],
   ```
3. Redeploy. The Worker will use it automatically and ignore Resend.

**If you configure neither**, the form still accepts submissions and logs them (visible via `npx wrangler tail`), but nobody gets emailed. Don't leave it like that.

### Optional but worth doing: keep a copy of every lead

Email can silently fail. To also store submissions in Cloudflare's key-value store:

```bash
npx wrangler kv namespace create LEADS
```

It prints an ID. Paste it into the commented `kv_namespaces` block at the bottom of `wrangler.jsonc`, uncomment, redeploy. Entries are kept 400 days and you can read them with `npx wrangler kv key list --binding LEADS`.

---

## 7. Turnstile (stopping spam)

Without this you will get form spam, and insurance forms attract a lot of it.

1. Dashboard → **Turnstile** → **Add widget**.
2. Hostnames: `longhornshield.org` and `www.longhornshield.org`. Widget mode: **Managed**.
3. You get a **site key** (public) and a **secret key** (private).
4. Put the site key in `quote.html`, replacing `PASTE_TURNSTILE_SITE_KEY`.
5. Store the secret:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

For local testing, Cloudflare publishes keys that always pass: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. They're already in `.dev.vars.example`.

The Worker skips the bot check entirely if `TURNSTILE_SECRET_KEY` isn't set, so the form works before you get to this step. It also has a hidden honeypot field that catches simpler bots regardless.

---

## 8. Test before you announce it

- [ ] Every page loads, header and footer links all work
- [ ] Phone numbers dial correctly when tapped on a phone
- [ ] Submit the form with everything filled in → you land on `/thanks.html` and the email arrives
- [ ] Submit with a blank name → an inline error appears, nothing is sent
- [ ] Submit with a 3-digit phone number → rejected
- [ ] Visit `longhornshield.org/nonsense` → your 404 page, not Cloudflare's
- [ ] Load the site on a phone, not just a narrowed desktop window
- [ ] Reply to a form notification email — it should go to the customer, because the Worker sets reply-to
- [ ] Check the notification email didn't land in spam (a first-send problem that fixes itself once DNS records propagate)

Then: submit the domain to Google Search Console and Bing Webmaster Tools, and add the `sitemap.xml` URL in both.

---

## 9. What this costs

| | Monthly | Notes |
|---|---|---|
| Domain | ~$1 | Billed yearly at cost if you use Cloudflare Registrar |
| Workers free plan | $0 | 100,000 Worker invocations a day. Static file requests aren't billed at all, so only form submissions count |
| Turnstile | $0 | |
| Email Routing | $0 | |
| Resend | $0 | Up to 3,000 emails/month |
| **Total** | **~$1/month** | |

You'd only move to the Workers Paid plan ($5/month) for Cloudflare's native Email Sending, or if traffic somehow exceeded 100,000 form-endpoint hits a day.

---

## 10. Editing the site later

The site is plain HTML — no build step, no framework, no npm packages in the browser. Open a file in any text editor, change the words, save.

- **Change copy or add a page**: edit or copy an HTML file. If you add a page, add it to `sitemap.xml` and to the footer links.
- **Change colours or type**: the top of `styles.css` has every colour and font size as a named variable. Change `--marigold` and every button, numeral, and stud updates at once. See section 12 for what each one is.
- **Add a form field**: add the input to `quote.html`, then add it to the `lead` object and the `rows` array in `src/index.js` so it appears in the email.
- **Add analytics**: Cloudflare Web Analytics is free, privacy-friendly, and needs no cookie banner — enable it under **Analytics** → **Web Analytics**. If you add Google Analytics instead, you must also add its domains to the `Content-Security-Policy` line in `public/_headers`, or the browser will block the script.

Then redeploy: push to GitHub (Route B), run `npx wrangler deploy` (Route C), or re-upload (Route A).

---

## 11. Things specific to selling insurance online

Not legal advice, and I'm not a lawyer — but these are the ones agencies get caught by, so raise them with whoever handles your compliance.

- **License display.** Texas Department of Insurance rules govern how agencies advertise. Your legal entity name and license number are in the footer template; confirm the exact format your state expects, and don't imply you're licensed in states where you aren't.
- **The consent checkbox matters.** Calling or texting a lead without documented consent is TCPA exposure, and the plaintiff's bar actively works this area. The checkbox on the form is required and its exact wording is recorded in the notification email. Keep those emails, or better, turn on the KV backup in section 6 so you have a timestamped record.
- **Don't collect sensitive data through the form.** The form deliberately has no field for Social Security number, driver's license number, date of birth, or VIN, and says so on the page. Collecting that through a web form pulls you into a much bigger set of data-protection obligations. Gather it by phone or through your carrier's secure portal.
- **The privacy page is a starting template only.** Insurance producers have specific obligations under Gramm-Leach-Bliley, and Texas has its own data privacy act. Have it reviewed.
- **Coverage descriptions are marketing copy.** The disclaimer in the footer says the descriptions aren't a contract. Keep it there, and have someone check that nothing on the coverage pages reads as a promise a policy wouldn't keep.
- **Accessibility.** The site is keyboard-navigable, has visible focus rings, real form labels, and passes contrast checks. Worth keeping that way — insurance websites do get ADA demand letters.
- **One deliberate design decision:** the site avoids burnt orange entirely, and the emblem is an Ankole longhorn in a laced Nguni shield rather than anything resembling the University of Texas marks. UT enforces its trademarks hard, and "Longhorn" plus burnt orange plus a steer silhouette is exactly the combination that draws a letter. Still worth a trademark search on the name itself before you spend money on signage and vehicle wraps.

---

## 12. The design system, if you want to change it

Everything visual is defined at the top of `public/styles.css` as CSS custom properties. No build step, no Sass, no Tailwind — edit a value, save, reload.

**Colours**

| Variable | Value | Where it shows up |
|---|---|---|
| `--indigo` | `#1e2a4f` | Hero, page headers, the dark bands, the form sidebar |
| `--indigo-deep` | `#141d38` | Footer |
| `--raffia` | `#f7eedd` | Page background, text on dark |
| `--raffia-2` | `#efe2ca` | Alternating band background |
| `--marigold` | `#e3a72f` | Buttons, concho discs, step numerals, the call-to-action band |
| `--clay` | `#b8402a` | Links, subheadings, button hover, pattern diamonds |
| `--kola` | `#146b52` | Checkbox tick, accents on the secondary emblem |
| `--ink` / `--ink-2` / `--ink-3` | browns | Body text, secondary text, hints |

**Type.** Bodoni Moda for anything display — a high-contrast fat face in the tradition of 19th-century Western show posters. Karla for body text, because it's warm and slightly quirky where most UI sans faces are neutral. Both are variable fonts served from Google Fonts in one request.

**The woven strip.** The band of gold rails, cream and clay diamonds on indigo, in the register of West African strip-weaving. It's a single tiling SVG stored in the `--strip` variable as a data URI, drawn wherever you put `<div class="strip"></div>`. Change the colours inside that variable and every strip on the site changes together — note the hex codes are written `%23xxxxxx` because `#` has to be escaped inside a data URI.

**The emblem.** Inline SVG, no image file, so it's crisp at any size and recolours with CSS. The `.crest` class draws it; `.crest--hero` is the large gold version, `.crest--sm` the small clay one in the header. The horns and shield outline draw themselves once on page load — the site's only piece of unprompted motion, and it's switched off automatically for anyone who has reduced motion enabled in their operating system.

**Things worth leaving alone.** The strip has a `role="presentation"` so screen readers skip it. Every form input has a real `<label>`. Focus outlines are 3px marigold and deliberately visible. Contrast ratios on the gold-on-indigo and indigo-on-gold combinations were checked; if you darken the marigold or lighten the indigo, check them again.

---

## 13. When something goes wrong

**The form returns an error.** Run `npx wrangler tail` and submit again — the actual error prints live. Most often it's an unverified Resend domain, or a Turnstile secret that doesn't match the site key.

**Turnstile shows an error box on the page.** The site key in `quote.html` is wrong, or the hostname you're testing from isn't in the widget's hostname list. Add `localhost` to that list for local testing.

**Fonts aren't loading**, and the page looks like Times New Roman. Check the `Content-Security-Policy` line in `public/_headers` still allows `fonts.googleapis.com` and `fonts.gstatic.com`. If you'd rather not depend on Google, download Bodoni Moda and Karla, drop the files in `public/fonts/`, and swap the stylesheet link for a local `@font-face` block.

**The domain shows a Cloudflare error page.** DNS has propagated but the Worker has no custom domain attached, or vice versa. Re-check section 5.

**The woven strip vanishes after you edit its colours.** A `#` got left un-escaped inside the `--strip` data URI in `styles.css`. Every hex colour in there has to be written `%23xxxxxx`, not `#xxxxxx`.

**Changes aren't showing up.** Hard-refresh (Ctrl/Cmd + Shift + R). If it persists, **Caching** → **Configuration** → **Purge Everything**.
