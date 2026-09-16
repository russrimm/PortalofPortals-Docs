# Portal 360° product tour

A visual tour of Portal 360°, a unified administration portal for Microsoft
Entra ID, Microsoft 365, Intune, Azure, Power Platform, and Microsoft Fabric.

Every image below was captured from a live tenant in dark mode at 3200×2000 and
downscaled for the repository.

Images without an approved fresh capture are retained from earlier runs. See
the [full gallery](README.md) for current refresh status and pages not pictured.

## Where to find more

This page is a curated walkthrough of 29 marquee pages. For every page
that has a published screenshot, see the [full gallery](README.md). The complete
set of **273 curated pages** is browsable in the app itself at
**`/screenshots`**, with per-page descriptions and the admin actions each page
supports.

Full-resolution captures are written to `artifacts/screenshots/` and are
intentionally excluded from version control (~120 MB). To regenerate this tour:

```bash
# 1. Sign in once and save the browser session
pnpm screenshots:auth

# 2. Capture every marketing-worthy page
pnpm screenshots:marketing

# 3. Rebuild this tour from the captures
pnpm screenshots:docs
```

A page that already has a published image is kept as-is when a run has no fresh
capture for it, so a narrowed `ONLY=` run never drops committed screenshots.

The capture run writes an audit to `artifacts/marketing-screenshot-report.md`
listing every page and whether it was sales-ready, empty of tenant data, or
rendering an error.

---

## Portal Home

![Portal Home](home.webp)

The Portal 360° home page in dark mode. Provides a high-level overview of the entire Microsoft cloud environment including quick-access tiles, tenant health signals, and recent activity highlights.

---

## Governance Dashboard

![Governance Dashboard](dashboard.webp)

Central governance dashboard aggregating key security, compliance, and operational metrics across Azure and Microsoft 365. Shows Secure Score, risky users, device compliance, and service health in a single view.

---

## Security Pulse

![Security Pulse](security-pulse.webp)

Live CVE intelligence from NVD, MSRC, and CISA KEV. Rendered against live tenant data with 4 summary metrics, 10 charts.

---

## User Management

![User Management](users.webp)

Comprehensive user directory showing all Entra ID users with their status, license assignments, and last sign-in date. Supports search, filter, and bulk operations.

---

## Group Management

![Group Management](groups.webp)

Azure AD group administration showing security groups, Microsoft 365 groups, and distribution lists. Supports membership management, dynamic groups, and group-based licensing.

---

## Roles and Administrators

![Roles and Administrators](entra-roles-and-administrators.webp)

Entra ID directory roles — built-in and custom. Rendered against live tenant data with 4 summary metrics.

---

## Enterprise Applications

![Enterprise Applications](enterprise-applications.webp)

Comprehensive enterprise application management showing all apps assigned to the tenant including SAML SSO apps, OAuth apps, and provisioning-enabled applications.

---

## Conditional Access Policies

![Conditional Access Policies](conditional-access.webp)

Full view of all Conditional Access policies in the tenant with state (enabled, disabled, report-only), assignment scope, and grant/session controls.

---

## Microsoft Secure Score

![Microsoft Secure Score](secure-score.webp)

Microsoft 365 Secure Score showing the overall security posture with completed and recommended improvement actions. Tracks score trends and compares with similar organizations.

---

## Defender for Endpoint

![Defender for Endpoint](defender-atp.webp)

Configuration required.

---

## Insight — MFA Gap

![Insight — MFA Gap](insights-mfa-gap.webp)

Users without any MFA method registered in the tenant. Rendered against live tenant data with 3 summary metrics, 3 live records.

---

## License Management

![License Management](licensing.webp)

Centralized license management view showing all Microsoft 365 and Azure subscriptions, license counts, assigned quantities, and per-service-plan breakdowns.

---

## Azure Infrastructure Overview

![Azure Infrastructure Overview](azure-infrastructure.webp)

Top-level Azure Infrastructure page providing navigation to resource management, organization hierarchy, cost management, policy, and monitoring capabilities.

---

## Azure Virtual Machines

![Azure Virtual Machines](azure-virtual-machines.jpg)

Complete inventory of Azure Virtual Machines across all subscriptions with power state, size, OS, location, and resource group. Supports start/stop operations.

---

## Virtual Machine AI Diagnostics

![Virtual Machine AI Diagnostics](azure-virtual-machine-ai-diagnostics.jpg)

AI-powered diagnostics for Azure Virtual Machines that analyzes performance data, identifies anomalies, and provides natural language explanations and remediation suggestions.

---

## Azure Daily Costs

![Azure Daily Costs](azure-daily-costs.webp)

Day-by-day Azure spend breakdown for August 2026. Rendered against live tenant data with 3 summary metrics, 3 live records, 11 charts.

---

## Azure Monitor Metrics

![Azure Monitor Metrics](azure-metrics.webp)

Azure Monitor metrics explorer for visualizing resource performance metrics over custom time ranges. Supports multiple resources, metrics, and aggregation types.

---

## Service Health

![Service Health](service-health.jpg)

Real-time Microsoft 365 and Azure service health status showing active incidents, advisories, and service degradations across all Microsoft cloud services.

---

## AI Foundry — Deployments

![AI Foundry — Deployments](azure-ai-foundry-deployments.webp)

Manage AI model deployments within an AI Foundry account.

---

## Copilot Readiness

![Copilot Readiness](microsoft365-copilot-readiness.webp)

Who is ready for a Microsoft 365 Copilot seat, who is sitting on one they never use, and which seats you can move today without buying anything. Ports Microsoft\\'s M365UsageAnalytics readiness model onto live Graph data — no audit-log export required. Rendered against live tenant data with 4 summary metrics, 5 charts.

---

## Exchange Admin Dashboard

![Exchange Admin Dashboard](exchange-admin-dashboard.webp)

Exchange Online policy compliance and mailbox health overview. Rendered against live tenant data with 5 summary metrics, 6 live records.

---

## SharePoint Sites

![SharePoint Sites](sharepoint-sites.webp)

SharePoint Online site collection inventory showing site type, storage usage, last modified date, and owner. Supports site lifecycle management operations.

---

## Teams Meeting Insights

![Teams Meeting Insights](teams-meeting-insights.jpg)

Retrieve AI-generated meeting summaries, action items, and participant mentions from concluded Teams meetings.

---

## Intune Managed Devices

![Intune Managed Devices](device-management-devices.webp)

Complete Intune device inventory showing all managed devices with enrollment type, compliance state, OS version, last check-in, and assigned user.

---

## Encryption Report

![Encryption Report](device-management-encryption-report.webp)

BitLocker, FileVault, and device encryption readiness from /deviceManagement/managedDeviceEncryptionStates. Rendered against live tenant data with 12 live records, 3 charts.

---

## Power Platform Environments

![Power Platform Environments](power-platform-environments.jpg)

Complete inventory of all Power Platform environments with type (Default, Production, Sandbox), region, managed environment state, and capacity consumption.

---

## Copilot Studio Dashboard

![Copilot Studio Dashboard](power-platform-copilot-studio-dashboard.webp)

Select report pages for telemetry, governance, environments, authentication, and connector usage.

---

## Fabric Admin — Workspaces

![Fabric Admin — Workspaces](fabric-admin-workspaces.webp)

Tenant-wide view of every Fabric workspace (requires Fabric admin).

---

## Reports Hub

![Reports Hub](reports.webp)

68 reports across 18 categories · Powered by Microsoft Graph reportRoot API.

---

_Generated by `scripts/build-docs-screenshot-gallery.mjs`._
