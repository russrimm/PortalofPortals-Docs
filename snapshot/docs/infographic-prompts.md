# Portal 360° — Infographic Image Generation Prompts

Use these prompts with AI image tools such as **DALL-E 3**, **Midjourney**, **Adobe Firefly**, or **Ideogram** to generate marketing infographics. Each prompt is self-contained and tuned for a specific audience or message.

---

## 1. Unified Administration Platform Overview

**Target:** Executive sponsors, IT decision makers  
**Format:** Wide hero banner / slide header

```
A clean, modern tech infographic on a deep navy blue background titled "Portal 360° — One Workspace for Everything Microsoft". 

Center: a sleek browser window showing a unified dark-themed dashboard with data cards, charts, and a left navigation sidebar.

Surrounding the browser, six labeled hexagons connected by subtle glowing lines, each with a flat icon and label:
• Microsoft 365 — user with envelope icon
• Identity & Security — shield-lock icon  
• Azure Infrastructure — cloud-server icon  
• Power Platform — lightning-bolt icon  
• Device Management — laptop-shield icon  
• Collaboration & Health — chat-bubble icon  

Bottom bar: tag line "One login. Every Microsoft service. Zero context-switching." in clean sans-serif white text.

Style: flat illustration, Microsoft Fluent design language, soft glow effects on icons, crisp typography, professional SaaS marketing aesthetic. No gradients on text. 16:9 aspect ratio.
```

---

## 2. Capabilities Wheel — What Portal 360° Covers

**Target:** IT pros, MSP engineers evaluating the platform  
**Format:** Square card / social post

```
A circular capability wheel infographic on a dark charcoal (#1e1e2e) background titled "Portal 360° — Everything in One Place" at the top in bold white text.

The wheel has 8 equal segments radiating from a central glowing circle that contains the text "Portal 360°" in white. Each segment has a distinct accent color, a flat icon, and a short label:

Segment 1 (blue) — Identity & Security: users, PIM, Conditional Access, Risky Users
Segment 2 (cyan) — Microsoft 365: Licensing, Copilot usage, Agent Registry
Segment 3 (purple) — Azure Infrastructure: VMs, Policy, Budgets, Advisor
Segment 4 (green) — Power Platform: Environments, Copilot Studio, DLP, Dataverse
Segment 5 (orange) — Device Management: Intune, Compliance, Windows Updates
Segment 6 (teal) — Collaboration: Exchange, Teams, SharePoint, OneDrive
Segment 7 (red) — Security & Compliance: Defender, Secure Score, Purview
Segment 8 (yellow) — Operations: ServiceNow, Azure DevOps, Fabric, AI Foundry

Bottom caption: "Powered by Microsoft Graph · Azure · Power Platform APIs"

Style: flat vector, dark tech aesthetic, thin glowing dividers between segments, Fluent-inspired icons, no gradients on text, clean and corporate. 1:1 aspect ratio.
```

---

## 3. Before vs. After — IT Admin Day Without/With Portal 360°

**Target:** IT admins, MSP technicians  
**Format:** Split-panel comparison (wide)

```
A split-panel infographic on a white background, divided vertically into two halves.

LEFT PANEL — "Before Portal 360°" (muted red-gray palette):
Title in dark red: "Before Portal 360°"
A frazzled IT admin character at a cluttered desk with 8 browser tabs open showing logos of: Entra ID portal, Azure portal, Intune portal, Teams admin center, Exchange admin center, Power Platform admin center, Microsoft 365 admin center, ServiceNow.
Below the character, three bullet points with ✗ icons:
✗ Switching between 8+ admin portals
✗ No unified audit trail
✗ Repetitive sign-ins and context loss

RIGHT PANEL — "After Portal 360°" (calm blue-green palette):
Title in deep blue: "After Portal 360°"
A calm, confident IT admin at a clean desk with a single browser window showing a unified dark-themed dashboard.
Below the character, three bullet points with ✓ icons:
✓ Single pane of glass for all Microsoft services
✓ Cross-service actions and audit-ready workflows
✓ Server-side security — tokens never leave the server

Center dividing line: vertical gradient from red-gray to blue-green with a lightning bolt icon.

Footer: "Portal 360° — Manage everything Microsoft, from one place."

Style: clean flat illustration, professional cartoon characters (gender-neutral), modern SaaS comparison aesthetic. 16:9 aspect ratio.
```

---

## 4. Security-First Architecture

**Target:** Security architects, compliance officers, CISOs  
**Format:** Technical diagram / vertical poster

```
A technical architecture infographic on a very dark navy background titled "Portal 360° — Security-First BFF Architecture" in bold white sans-serif.

Three-tier vertical diagram with labeled layers:

TOP LAYER — "Browser (User)" (light blue box):
Icons: user silhouette, browser window
Label: "HttpOnly session cookie only — no tokens in browser"
Arrow pointing DOWN labeled "Secure session cookie (HttpOnly, SameSite=Lax)"

MIDDLE LAYER — "Next.js BFF Server" (glowing blue box, center of diagram):
Icons: server rack, shield, lock
Sub-labels in the box:
• NextAuth v5 session verification
• MSAL On-Behalf-Of token flow
• CSP nonces generated per request
• All API routes authenticated first
• Tokens stored server-side only
Arrows pointing RIGHT and LEFT to downstream APIs

BOTTOM / RIGHT LAYER — "Microsoft Cloud APIs" (purple boxes):
Four boxes in a row:
• Microsoft Graph API
• Azure Management API
• Power Platform API
• AI Foundry API

A large red X with text: "Tokens NEVER sent to browser, localStorage, or logs"
A green check: "All mutations require CSRF token + Origin validation"

Style: clean flat technical diagram, dark cybersecurity aesthetic, Fluent-inspired icons, glow effects on the server layer, color-coded layers, no decorative flourishes. Vertical 9:16 or 3:4 aspect ratio.
```

---

## 5. MSP / Enterprise ROI — Key Benefits at a Glance

**Target:** Procurement, IT managers, MSP owners  
**Format:** Horizontal stats card strip

```
A horizontal stats-and-benefits infographic on a gradient background (deep blue to dark teal) titled "Why Teams Choose Portal 360°" in large white bold text.

Five equally-spaced benefit cards in a single row, each with:
• A large bold stat or icon at the top
• A one-line benefit label below
• A short two-line explanation beneath

Card 1 — icon: clock with arrow
Stat: "8 → 1"
Label: "Portals Consolidated"
Detail: Manage Entra, Intune, Azure, M365, Power Platform and more — all in one place.

Card 2 — icon: shield check
Stat: "Zero Trust"
Label: "Security Architecture"
Detail: BFF pattern keeps tokens server-side. HttpOnly cookies. CSP nonces on every request.

Card 3 — icon: lightning bolt
Stat: "200+"
Label: "Admin Workflows"
Detail: From PIM activations to Intune compliance to ServiceNow ticketing — all automated.

Card 4 — icon: eye / audit log
Stat: "100%"
Label: "Audit-Ready"
Detail: Every cross-service action flows through a centralized, audit-friendly access layer.

Card 5 — icon: AI sparkle
Stat: "AI-Powered"
Label: "Microsoft Copilot & Foundry"
Detail: Native integration with Microsoft AI Foundry and Copilot usage reporting.

Footer text: "Built on Next.js 16 · React 19 · Microsoft Graph · NextAuth v5"

Style: flat card design, dark tech color scheme, large readable stats, Fluent-inspired icons, subtle card borders with soft glow, no clutter. 16:9 landscape.
```

---

## Usage Tips

| Tool | Best for | Notes |
|------|----------|-------|
| **DALL-E 3** (ChatGPT) | Quick concept images | Follows complex layouts well |
| **Midjourney v6** | Polished visual style | Add `--ar 16:9` or `--ar 1:1` |
| **Adobe Firefly** | Brand-safe, commercial use | Good Fluent/corporate style |
| **Ideogram** | Text accuracy in images | Best for stat-heavy cards |

For best results, append the following to any prompt:
> `high resolution, no watermarks, professional quality, clean flat design, consistent color palette`
