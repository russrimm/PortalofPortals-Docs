# Portal 360° Documentation Index

**Complete documentation guide for IT administrators and developers**  
**Last Updated:** July 27, 2026

Welcome to the Portal 360° documentation. This index helps you find the right documentation for your needs.

---

## 📚 Documentation Overview

| Document | Audience | Purpose | When to Use |
|----------|----------|---------|-------------|
| [Developer Setup](./development.md) | Developers | End-to-end local dev workflow (install, env, conventions, testing) | First-time setup, contributing changes, regenerating the OpenAPI schema |
| [Administrator Guide](./admin-guide.md) | IT Administrators | Post-deployment operations, RBAC, observability, incident response | Running Portal 360 in production day-to-day |
| [Auth Provider Setup](./auth-providers.md) | IT Administrators | Entra ID app registration, scopes, OBO flow, redirect URIs | Initial Entra ID setup and adding new Microsoft API surfaces |
| [Managed Identity Setup](./MANAGED-IDENTITY-SETUP.md) | IT Administrators & Engineering | Federated identity credentials to retire `AZURE_CLIENT_SECRET`, plus 90-day secret rotation | Moving off client secrets, or rotating them where federation isn't possible |
| [API Integration Guide](./api-integration.md) | Developers & Integrators | How to call the BFF (session cookie + CSRF + Swagger UI / ReDoc / OpenAPI) | Building first-party UI calls or test scripts against the API |
| [API Documentation](./API-DOCUMENTATION.md) | IT Administrators | Complete API reference with authentication, permissions, and setup | Setting up the application, configuring permissions, understanding authentication flows |
| [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | Developers & IT Admins | Quick lookup of all API endpoints | Troubleshooting API calls, finding endpoint documentation, understanding rate limits |
| [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | IT Administrators | Step-by-step production deployment guide | Deploying to production, ensuring proper configuration, security review |
| [Network Hardening](./NETWORK-HARDENING.md) | IT Administrators & Security | Small/mid/large deployment tiers for App Service access restrictions, VNet integration, private endpoints, and Front Door/WAF | Locking down the network path for a corporate or regulated deployment |
| [Azure SRE Agent (IaC)](./azure-sre-agent-iac.md) | IT Administrators & Engineering | Provisioning an Azure SRE Agent with the repo's Bicep template — `SRE_AGENT_*` variables, required permissions, and the access-level/action-mode safety matrix | Turning the SRE Agent on, or deciding how much authority to give it |
| [Azure SRE Agent Investigations](./azure-sre-agent-investigations.md) | IT Administrators & Engineering | Surfacing SRE Agent investigation threads in the Portal 360 security queue — data-plane auth, the SignalR-vs-polling decision, and how the undocumented message schema is sanitized | Working on the investigations queue, or auditing what agent data reaches the browser |
| [Security Review — 2026-07-01](./code-review/2026-07-01-portal360-security-review.md) | Security & Engineering | Latest full-repo security review with status of each finding | Verifying remediation status, planning next security work |
| [Troubleshooting Guide](./TROUBLESHOOTING.md) | IT Administrators | Common issues and solutions | Diagnosing authentication problems, permission errors, API failures |
| [Quick Start Guide](./quick-start.md) | Developers | Get up and running quickly | First-time setup, local development |
| [Application Installation](./application-installation.md) | IT Administrators | Detailed installation and deployment | Installing on Azure, Kubernetes, or other hosting |
| [Application Walkthrough](./application-walkthrough.md) | End Users | Feature tour and usage guide | Learning application features, training new users |
| [Azure Policy Enterprise Recommendations](./azure-policy-enterprise-recommendations.md) | Product Owners & Developers | Tracks top Azure Policy and Entra-aware enterprise governance recommendations | Prioritizing roadmap work and checking recommendation status |
| [Human Review Queue](./human-review-queue.md) | Developers & Power Platform admins | Copilot Studio human-in-the-loop connector-risk review setup | Adding workflow approvals that resume through Portal 360 |
| [Copilot Agent Kit integration](./copilot-agent-kit-integration.md) | Power Platform admins & Developers | The Agent Review page: what was ported from Microsoft's Copilot Agent Kit, the 10 deterministic checks, the 15 instruction criteria, and how to export a solution `.zip` | Reviewing agent quality before release, tuning thresholds, or configuring the optional AI instruction check |
| [Copilot Studio agent usage](./copilot-studio-usage-calculation.md) | Power Platform admins & Developers | **Telemetry source map** for all six Copilot Studio telemetry surfaces, plus how transcript-derived usage KPIs, outcomes, and citations are computed | Working out which telemetry can answer a question, or tracing where a usage number came from |
| [Copilot Studio tool & connector call report](./copilot-studio-tool-call-report.md) | Power Platform admins & Developers | Runtime connector/tool usage from environment-level `ExecuteTool` spans: the span model, the `gen_ai.*` dimensions, and the sampling and `success`-typing caveats | Auditing which connectors agents actually call, finding dead connector bindings, or diagnosing an empty report |
| [Power Platform schema sync](./power-platform-schema-sync.md) | Developers & Platform owners | Weekly workflow that keeps the tenant-settings registry and inventory `api-version` aligned with upstream Microsoft sources | Reviewing the auto-opened PR, running the syncs locally, or extending the central `INVENTORY_QUERY_URL` constant |
| [Power Platform solution analysis](./power-platform-solution-analysis.md) | Power Platform admins & Developers | The shared analysis pipeline behind both analyze routes: component inventory, flow lint, Canvas App Power Fx and delegation rules, redacted secret scan, limits, and the Azure OpenAI brief | Analyzing a Dataverse-exported or hand-uploaded solution `.zip`, tuning rules, or diagnosing a 413/422 from the analyze routes |
| [Power Platform environment request form](./power-platform-environment-request.md) | Power Platform admins & Developers | Self-service `new environment` form backed by a Logic App; covers payload schema, Logic App contract, configuration env vars | Wiring up the Logic App, adjusting the Zod schema, or diagnosing submission errors |
| [Demo Walkthrough Video Plan](./demo-walkthrough-video.md) | Sales Engineers & Product Teams | Time-boxed walkthrough plan for customer demos | Recording or presenting Portal 360 capabilities to prospects |
| [Video Transcript](./video-transcript.md) | Sales Engineers & Product Teams | Narration script focused on customer value and outcomes | Voiceover script for demo videos and live presentations |
| [Fabric Lakehouse Detail View](./fabric-lakehouse-detail-view.md) | Developers & IT Admins | `/fabric/lakehouses/[workspaceId]/[lakehouseId]` page and API contract, with a request-flow sequence diagram | Troubleshooting lakehouse access, wiring new callers to the API, or extending the parallel Fabric fan-out |
| [PAX Fabric Integration](./pax-integration.md) | IT Administrators & Developers | End-to-end PAX / Fabric SQL config, service-principal token flow, `/api/pax/health` payloads, decision-tree diagram, and AADSTS troubleshooting | Diagnosing lakehouse connectivity, configuring Fabric service-principal access, or updating `PAX_FABRIC_*` env vars |
| [Recent UI/UX Polish (2026)](./ui-ux-polish-2026.md) | Developers | Log of small UI-only changes that don't warrant their own implementation doc | Locating when a nav / icon / collapse behavior changed |

---

## 🔎 Interactive API Reference

When a Portal 360° instance is running, the following endpoints serve a live, session-authenticated API reference:

- **OpenAPI schema:** `GET /api/openapi.json`
- **Swagger UI:** `GET /api/docs` — `withCredentials: true`; auto-forwards the CSRF cookie as `X-CSRF-Token` for same-origin mutating requests
- **ReDoc:** `GET /api/redoc`

Regenerate the underlying schema with `pnpm run docs:openapi` whenever an API route changes.

---

## 🚀 Getting Started Paths

### For IT Administrators Setting Up for the First Time

**Follow this sequence**:

1. **[Quick Start Guide](./quick-start.md)** (10 minutes)
   - Understand basic requirements
   - Set up development environment
   - Verify basic functionality

2. **[API Documentation](./API-DOCUMENTATION.md)** (1-2 hours)
   - Create Azure app registration
   - Configure API permissions
   - Set up Power Platform access
   - Configure environment variables

3. **[Deployment Checklist](./DEPLOYMENT-CHECKLIST.md)** (Follow before production)
   - Verify all configurations
   - Set up security (Key Vault)
   - Plan deployment
   - Execute production deployment

4. **[Troubleshooting Guide](./TROUBLESHOOTING.md)** (As needed)
   - Diagnose any issues encountered
   - Resolve permission errors
   - Fix authentication problems

### For Developers Contributing to the Project

**Follow this sequence**:

1. **[Quick Start Guide](./quick-start.md)** (10 minutes)
   - Clone repository
   - Install dependencies
   - Run local development server

2. **[API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md)** (Reference)
   - Understand which APIs are used where
   - Find endpoint documentation
   - Learn about rate limits

3. **[Copilot Instructions](../.github/copilot-instructions.md)** (For AI-assisted development)
   - Understand project structure
   - Learn coding conventions
   - Review authentication patterns

4. **[API Documentation](./API-DOCUMENTATION.md)** (Deep dive)
   - Understand authentication flows
   - Learn token acquisition patterns
   - Implement new API integrations

### For End Users Learning the Application

**Follow this sequence**:

1. **[Application Walkthrough](./application-walkthrough.md)** (30 minutes)
   - Tour of all features
   - Learn navigation
   - Understand key capabilities

2. **Screenshots** (Visual reference)
   - See example screens
   - Understand expected output
   - Compare with your environment

---

## 📖 Documentation by Topic

### Authentication & Security

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **Setting up Azure AD authentication** | [API Documentation](./API-DOCUMENTATION.md) | Authentication Architecture |
| **Creating app registration** | [API Documentation](./API-DOCUMENTATION.md) | Application Registration Setup |
| **Configuring OAuth flows** | [API Documentation](./API-DOCUMENTATION.md) | Microsoft Entra ID |
| **Managing secrets securely** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Security & Secrets Management |
| **Retiring the client secret** | [Managed Identity Setup](./MANAGED-IDENTITY-SETUP.md) | Federated identity credentials |
| **Rotating the client secret** | [Managed Identity Setup](./MANAGED-IDENTITY-SETUP.md) | 90-day secret rotation |
| **Troubleshooting login issues** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Authentication Issues |
| **Understanding token types** | [API Documentation](./API-DOCUMENTATION.md) | Token Types |
| **Why NextAuth is pinned to a beta** | [NextAuth v5 beta: accepted risk](./NEXTAUTH-BETA-RISK.md) | The pin is the patched version |

### API Permissions & Roles

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **Microsoft Graph permissions** | [API Documentation](./API-DOCUMENTATION.md) | Microsoft Graph API → Required API Permissions |
| **Azure RBAC roles** | [API Documentation](./API-DOCUMENTATION.md) | Azure Resource Manager API → Required API Permissions |
| **Power Platform roles** | [API Documentation](./API-DOCUMENTATION.md) | Power Platform API → Required Power Platform Roles |
| **Dataverse security roles** | [API Documentation](./API-DOCUMENTATION.md) | Dataverse API → Required Permissions |
| **Granting admin consent** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | API Permissions & Consent |
| **Troubleshooting permission errors** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Permission Errors |

### API Integration

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **List of all API endpoints** | [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | All sections |
| **Microsoft Graph endpoints** | [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | Users, Groups, Applications, etc. |
| **Azure Resource Manager endpoints** | [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | Azure Resources, Costs & Billing |
| **Power Platform endpoints** | [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | Power Platform Environments |
| **Dataverse endpoints** | [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) | Dataverse (Power Platform) |
| **Rate limits and throttling** | [API Documentation](./API-DOCUMENTATION.md) | Rate Limits (per API section) |
| **API error codes** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Common Error Codes |

### Configuration & Deployment

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **Environment variables** | [API Documentation](./API-DOCUMENTATION.md) | Environment Configuration |
| **Local development setup** | [Quick Start Guide](./quick-start.md) | All sections |
| **Production deployment** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Production Deployment |
| **Azure App Service deployment** | [Application Installation](./application-installation.md) | Deployment sections |
| **Docker/Kubernetes deployment** | [Application Installation](./application-installation.md) | Container sections |
| **Secret management** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Security & Secrets Management |
| **IP allowlists & access restrictions** | [Network Hardening](./NETWORK-HARDENING.md) | Control 1 |
| **VNet integration & private endpoints** | [Network Hardening](./NETWORK-HARDENING.md) | Controls 2–3 |
| **Front Door / WAF fronting** | [Network Hardening](./NETWORK-HARDENING.md) | Control 4 |

### Troubleshooting

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **Cannot sign in** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Authentication Issues |
| **403 Forbidden errors** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Permission Errors |
| **Power Platform not loading** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Power Platform Issues |
| **Token errors** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Token Problems |
| **API connection failures** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | API Connection Failures |
| **Rate limiting** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Common Error Codes |
| **Environment configuration** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Environment Configuration |

### Operations & Maintenance

| Topic | Primary Document | Section |
|-------|------------------|---------|
| **Monitoring setup** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Monitoring & Logging |
| **Creating alerts** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Configure Alerts |
| **Secret rotation** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Rotate Secrets |
| **Ongoing maintenance tasks** | [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) | Ongoing Maintenance |
| **Debugging techniques** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | Debugging Tools & Techniques |

---

## 🔍 Quick Reference Tables

### Environment Variables

| Variable | Required | Purpose | Where Documented |
|----------|----------|---------|------------------|
| `NEXTAUTH_URL` | Yes | Application URL | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |
| `NEXTAUTH_SECRET` | Yes | Session encryption | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |
| `AZURE_CLIENT_ID` | Yes | App registration ID | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |
| `AZURE_CLIENT_SECRET` | Yes | App secret | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |
| `AZURE_TENANT_ID` | Yes | Tenant ID | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |
| `AZURE_SUBSCRIPTION_ID` | No | For Azure Resource Graph | [API Docs](./API-DOCUMENTATION.md#environment-configuration) |

Full list: [API Documentation → Environment Configuration](./API-DOCUMENTATION.md#environment-configuration)

### Required Permissions Summary

| API | Permission Type | Key Permissions | Documented In |
|-----|----------------|-----------------|---------------|
| Microsoft Graph | Delegated | User.Read.All, Directory.Read.All, AuditLog.Read.All | [API Docs](./API-DOCUMENTATION.md#microsoft-graph-api) |
| Azure Resource Manager | Delegated | user_impersonation | [API Docs](./API-DOCUMENTATION.md#azure-resource-manager-api) |
| Azure RBAC | Role Assignment | Reader, Cost Management Reader, Monitoring Reader | [Installation Guide → Step 6b](./INSTALLATION-GUIDE.md#step-6b-assign-azure-subscription-rbac-to-signed-in-users) |
| Power Platform | Role | Power Platform Administrator | [API Docs](./API-DOCUMENTATION.md#power-platform-api) |
| Dataverse | Security Role | System Administrator | [API Docs](./API-DOCUMENTATION.md#dataverse-api) |

Full list: [API Documentation → Required Permissions Summary](./API-DOCUMENTATION.md#required-permissions-summary)

### Common Error Codes

| Code | Meaning | Quick Fix | Documented In |
|------|---------|-----------|---------------|
| 401 | Unauthorized | Check token is present and valid | [Troubleshooting](./TROUBLESHOOTING.md#common-error-codes) |
| 403 | Forbidden | Grant required permission | [Troubleshooting](./TROUBLESHOOTING.md#common-error-codes) |
| 429 | Rate Limit | Implement retry with backoff | [Troubleshooting](./TROUBLESHOOTING.md#common-error-codes) |
| AADSTS50011 | Reply URL mismatch | Add redirect URI to app registration | [Troubleshooting](./TROUBLESHOOTING.md#authentication-issues) |
| AADSTS65001 | Consent not granted | Grant admin consent | [Troubleshooting](./TROUBLESHOOTING.md#authentication-issues) |

Full list: [Troubleshooting Guide → Common Error Codes](./TROUBLESHOOTING.md#common-error-codes)

---

## 🔗 External Resources

### Microsoft Official Documentation

- **Microsoft Graph**: [https://learn.microsoft.com/en-us/graph/](https://learn.microsoft.com/en-us/graph/)
- **Azure Resource Manager**: [https://learn.microsoft.com/en-us/azure/azure-resource-manager/](https://learn.microsoft.com/en-us/azure/azure-resource-manager/)
- **Power Platform**: [https://learn.microsoft.com/en-us/power-platform/](https://learn.microsoft.com/en-us/power-platform/)
- **Microsoft Entra ID**: [https://learn.microsoft.com/en-us/azure/active-directory/](https://learn.microsoft.com/en-us/azure/active-directory/)
- **MSAL Node**: [https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-node](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-node)

### Tools & Utilities

- **Azure Portal**: [https://portal.azure.com](https://portal.azure.com)
- **Microsoft 365 Admin**: [https://admin.microsoft.com](https://admin.microsoft.com)
- **Power Platform Admin**: [https://admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com)
- **Microsoft Entra Admin**: [https://entra.microsoft.com](https://entra.microsoft.com)
- **Graph Explorer**: [https://developer.microsoft.com/graph/graph-explorer](https://developer.microsoft.com/graph/graph-explorer)
- **JWT Decoder**: [https://jwt.ms](https://jwt.ms)

### Framework Documentation

- **Next.js**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **NextAuth.js**: [https://next-auth.js.org](https://next-auth.js.org)
- **React**: [https://react.dev](https://react.dev)
- **Tailwind CSS**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)

---

## 📝 Documentation Maintenance

### Document Ownership

| Document | Owner | Last Updated | Review Frequency |
|----------|-------|--------------|------------------|
| API Documentation | IT Operations Lead | Nov 1, 2025 | Quarterly |
| API Endpoints Reference | Development Lead | Nov 1, 2025 | Quarterly |
| Deployment Checklist | DevOps Lead | Nov 1, 2025 | Quarterly |
| Troubleshooting Guide | Support Lead | Nov 1, 2025 | Monthly |
| Quick Start Guide | Development Lead | - | As needed |
| Application Installation | DevOps Lead | - | Quarterly |
| Application Walkthrough | Product Owner | - | Quarterly |

### Suggesting Documentation Updates

If you find errors or have suggestions for improving documentation:

1. **Open an issue** on GitHub with:
   - Document name
   - Section with issue
   - Description of problem or suggestion
   - Your contact information (optional)

2. **Submit a pull request** with:
   - Updated markdown file(s)
   - Description of changes
   - Reason for update

3. **Email documentation team** at: docs@company.com

### Documentation Standards

All documentation follows these standards:

- **Format**: Markdown (.md files)
- **Location**: `/docs` directory
- **Naming**: UPPERCASE-WITH-HYPHENS.md
- **Linking**: Relative links between docs
- **Updates**: Include "Last Updated" date
- **Review**: Quarterly review cycle
- **Accessibility**: Plain language, clear headings, tables for structured data

---

## 📞 Support

### Getting Help with Documentation

**Documentation unclear?**
- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) first
- Search for keywords in all documentation
- Review external Microsoft documentation links
- Contact documentation team: docs@company.com

**Technical issues?**
- Follow diagnostic steps in [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Check Application Insights for errors
- Review Azure service health
- Contact IT support: support@company.com

**Security concerns?**
- Review [Security & Secrets Management](./DEPLOYMENT-CHECKLIST.md#security--secrets-management)
- Contact security team immediately: security@company.com
- For client secret exposure, rotate immediately

### Training Resources

**For IT Administrators**:
- Schedule onboarding session with IT Operations team
- Review all documentation in sequence (2-4 hours)
- Practice deployment in staging environment
- Shadow experienced administrator during production deployment

**For Developers**:
- Review Quick Start Guide
- Explore codebase with IDE
- Read Copilot Instructions for AI-assisted development
- Pair program with experienced developer

**For End Users**:
- Watch the [Portal 360 demo walkthrough package](./demo-walkthrough-video.md)
- Read Application Walkthrough
- Schedule training session with admin team
- Practice in staging environment before production

---

## ✅ Documentation Checklist

Use this checklist to ensure you've reviewed necessary documentation:

### For Initial Setup
- [ ] Read Quick Start Guide
- [ ] Review API Documentation (Authentication section)
- [ ] Review API Documentation (Environment Configuration)
- [ ] Review API Documentation (Application Registration Setup)
- [ ] Review Deployment Checklist (Pre-Deployment)

### For Production Deployment
- [ ] Complete entire Deployment Checklist
- [ ] Review Security & Secrets Management section
- [ ] Review Troubleshooting Guide (skim for awareness)
- [ ] Bookmark API Endpoints Reference for quick lookup
- [ ] Set up monitoring per Deployment Checklist

### For Troubleshooting
- [ ] Review Troubleshooting Guide relevant section
- [ ] Check API Documentation for permission requirements
- [ ] Verify configuration in Environment Configuration section
- [ ] Use Debugging Tools & Techniques
- [ ] Consult Common Error Codes

### For Ongoing Operations
- [ ] Review Ongoing Maintenance section monthly
- [ ] Check for documentation updates quarterly
- [ ] Update team training materials as needed
- [ ] Contribute improvements to documentation

---

## 🆕 What's New

### November 1, 2025
- ✨ **New**: Comprehensive API Documentation with step-by-step setup
- ✨ **New**: API Endpoints Reference for quick lookup
- ✨ **New**: Production Deployment Checklist
- ✨ **New**: IT Administrator Troubleshooting Guide
- 📝 **Updated**: README with documentation references
- 📝 **Updated**: Environment variable security guidance

### Future Planned Updates
- Interactive troubleshooting wizard
- Automated deployment scripts
- Environment-specific configuration templates
- API usage analytics and optimization guide

---

## 📄 License & Legal

This documentation is part of the Portal 360° project and is subject to the same license terms. See [LICENSE](../LICENSE) file for details.

**Confidentiality**: This documentation may contain sensitive information about your organization's Microsoft environment. Treat it as confidential and do not share outside your organization without proper authorization.

---

**Documentation maintained by**: IT Operations & Development Team  
**Last comprehensive review**: November 1, 2025  
**Next scheduled review**: February 1, 2026

For questions about this documentation index or suggestions for improvement, contact: docs@company.com
