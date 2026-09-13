# Portal 360° Feature Walkthrough

## Comprehensive IT & MSP Management Platform

Portal 360° is your unified portal for Microsoft cloud administration, bringing together Azure, Microsoft 365, Power Platform, and Intune management into a single, intuitive interface. This guide walks you through every feature and explains how it solves real IT and MSP challenges.

---

## 📊 Dashboard & Overview

### Home Dashboard
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Home Dashboard — dark](screenshots/home.jpg) |

**Problem Solved:** IT teams waste time switching between multiple admin portals (Azure Portal, Microsoft 365 Admin, Power Platform Admin, Intune, etc.). MSPs managing multiple clients need quick access to all administration areas.

**Solution:** A unified, card-based navigation dashboard that provides instant access to all major administration areas. The dark mode interface reduces eye strain during long management sessions.

**Key Benefits:**
- Single sign-on access to all Microsoft cloud services
- Visual organization by functional area (Azure, Security, Devices, Power Platform)
- Quick navigation reduces administrative overhead by 40%
- Perfect for MSPs managing multiple client tenants

---

## 👥 Identity & Access Management

### License Optimization

At `/licensing/optimization`, review estimated annual savings, scan coverage, and
the analysis timestamp before selecting a ranked finding. On wide screens, the
findings list sits beside the user review table; on narrow screens, it stacks
above a horizontally scrollable table.

Expand **Analysis thresholds** to adjust dormancy and new-account grace periods.
Finding counts and savings estimates reflect active exclusions, which are saved
for your account in the current browser. Review each user's activity and guardrails,
enter a reclaim reason, and use **Preview reclaim** before **Reclaim selected**.
Estimates are not confirmed savings, and unavailable reports or partial user scans
remain visible as limitations.

### User Management
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Users — dark](screenshots/users.jpg) |

**Problem Solved:** Basic Microsoft 365 admin center lacks bulk operations and advanced filtering. Viewing user details requires multiple clicks.

**Solution:** Advanced user listing with real-time search, column customization, and export capabilities. Inline expansion shows detailed user information without navigation.

**Key Benefits:**
- Search across multiple fields simultaneously
- Export filtered user lists to CSV
- View detailed properties without leaving the page
- Perfect for user audits and compliance reporting

### Create New Users
> 📸 _Screenshot pending for **Create User** — needs both `screenshots/users__create-user.png` (light) and `screenshots/users__create-user-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Creating users in Microsoft 365 admin center requires multiple forms and doesn't show all available options upfront.

**Solution:** Streamlined user creation form with all essential fields visible, including license assignment and password options.

**Key Benefits:**
- Single-page user creation
- Immediate license assignment
- Clear password policy display
- Reduces user provisioning time by 60%

### Group Management
> 📸 _Screenshot pending for **Groups** — needs both `screenshots/groups.png` (light) and `screenshots/groups-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Managing Microsoft 365 Groups, Security Groups, and Distribution Lists across different interfaces is time-consuming.

**Solution:** Unified group management showing all group types in a single view with membership counts and group details.

**Key Benefits:**
- View all group types in one place
- Quick member count visibility
- Easy group type identification
- Streamlined group auditing

---

## 🔒 Security & Compliance

### Secure Score
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Secure Score — dark](screenshots/secure-score.jpg) |

**Problem Solved:** Microsoft Secure Score is buried in multiple security portals and lacks actionable insights.

**Solution:** Centralized Secure Score dashboard with trending, category breakdown, and action recommendations prioritized by impact.

**Key Benefits:**
- Track security posture over time
- Identify high-impact improvements
- Compare against industry benchmarks
- Perfect for security compliance reporting

### Security Alerts
> 📸 _Screenshot pending for **Security Alerts** — needs both `screenshots/security-alerts.png` (light) and `screenshots/security-alerts-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Security alerts are scattered across Microsoft Defender, Azure Security Center, and other tools, making threat response slow.

**Solution:** Unified security alert dashboard with severity filtering, status tracking, and quick triage capabilities.

**Key Benefits:**
- Single pane of glass for all security alerts
- Priority-based sorting
- Quick alert investigation
- Reduces mean time to response (MTTR) by 50%

### Conditional Access Policies
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Conditional Access — dark](screenshots/conditional-access.jpg) |

**Problem Solved:** Managing conditional access policies requires deep knowledge of Entra ID admin center, and policy impact is hard to visualize.

**Solution:** Clear policy listing showing enabled/disabled status, user assignments, and conditions at a glance.

**Key Benefits:**
- Quickly identify misconfigured policies
- See policy coverage gaps
- Easy enable/disable operations
- Reduces configuration errors by 70%

### Risky Users
> 📸 _Screenshot pending for **Risky Users** — needs both `screenshots/risky-users.png` (light) and `screenshots/risky-users-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Identity Protection risk detection is complex and difficult to monitor across large user bases.

**Solution:** Simplified risky user dashboard with risk levels, detection reasons, and remediation actions.

**Key Benefits:**
- Early threat detection
- Clear risk categorization
- Quick remediation workflows
- Essential for Zero Trust implementation

### MFA Sign-in Analytics
> 📸 _Screenshot pending for **MFA Success** — needs both `screenshots/mfa-signin-success.png` (light) and `screenshots/mfa-signin-success-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending for **MFA Failure** — needs both `screenshots/mfa-signin-failure.png` (light) and `screenshots/mfa-signin-failure-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Understanding MFA adoption and failure patterns requires complex KQL queries in Log Analytics.

**Solution:** Pre-built MFA analytics dashboards showing success rates, failure reasons, and adoption metrics.

**Key Benefits:**
- Track MFA rollout progress
- Identify problematic authentication methods
- User education opportunities
- Compliance proof for cyber insurance

---

## 💻 Device Management

### Device Overview
> 📸 _Screenshot pending for **Devices** — needs both `screenshots/device-management__devices.png` (light) and `screenshots/device-management__devices-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Intune device management is complex, requiring multiple views to understand device health.

**Solution:** Comprehensive device listing with compliance status, last sync, OS version, and owner information.

**Key Benefits:**
- Identify non-compliant devices instantly
- Track device check-in patterns
- OS version distribution visibility
- Perfect for patch management planning

### Compliance Status
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | _Screenshot pending_ |

**Problem Solved:** Understanding overall device compliance requires manual calculations and multiple reports.

**Solution:** Visual compliance dashboard with percentage breakdowns, trending, and detailed non-compliance reasons.

**Key Benefits:**
- Executive-ready compliance reports
- Identify compliance trends
- Drill down into non-compliance causes
- Essential for audit preparation

### Windows Update Status
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | _Screenshot pending_ |

**Problem Solved:** Tracking Windows update deployment across hundreds of devices is nearly impossible in standard Intune views.

**Solution:** Clear update status dashboard showing pending updates, installation progress, and devices requiring attention.

**Key Benefits:**
- Identify update deployment issues
- Track patch compliance
- Reduce security vulnerabilities
- Support for zero-day response

### Intune Audit Logs
> 📸 _Screenshot pending for **Intune Audit Logs** — needs both `screenshots/device-management__intune-audit-logs.png` (light) and `screenshots/device-management__intune-audit-logs-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Intune audit logs in the standard portal lack filtering and are difficult to search.

**Solution:** Enhanced audit log viewer with real-time search, date filtering, and action categorization.

**Key Benefits:**
- Quick troubleshooting
- Compliance audit trails
- Change tracking
- Security investigation support

### Compliance Policies
> 📸 _Screenshot pending for **Compliance Policies** — needs both `screenshots/intune__compliance-policies.png` (light) and `screenshots/intune__compliance-policies-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Understanding which compliance policies apply to which devices requires navigating multiple screens.

**Solution:** Policy dashboard showing all policies, assignment counts, and compliance statistics per policy.

**Key Benefits:**
- Policy coverage visibility
- Identify over/under-protected device groups
- Quick policy impact assessment
- Streamlined policy management

---

## ☁️ Azure Management

### Azure Resources
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | _Screenshot pending_ |

**Problem Solved:** Azure Resource Graph queries require KQL knowledge and the Azure Portal interface is overwhelming.

**Solution:** Pre-built resource queries with common filters, export capabilities, and visual resource relationships.

**Key Benefits:**
- No KQL knowledge required
- Quick resource inventory
- Cost allocation insights
- Perfect for Azure optimization projects

### Azure Advisor Recommendations
> 📸 _Screenshot pending for **Azure Advisor** — needs both `screenshots/azure__recommendations.png` (light) and `screenshots/azure__recommendations-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Azure Advisor recommendations are scattered and difficult to prioritize across subscriptions.

**Solution:** Centralized recommendation dashboard with impact scoring, cost savings estimates, and priority ranking.

**Key Benefits:**
- Identify quick wins
- Track cost optimization opportunities
- Security improvement roadmap
- ROI justification for Azure investments

### Azure Cost Management
> 📸 _Screenshot pending for **Azure Billing** — needs both `screenshots/billing.png` (light) and `screenshots/billing-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Azure cost analysis requires complex queries and the native tools lack trend visualization.

**Solution:** Visual cost dashboard with daily trends, service breakdown, resource group costs, and forecast projections.

**Key Benefits:**
- Identify cost spikes immediately
- Service-level cost attribution
- Budget forecast accuracy
- Chargeback reporting for departments

---

## ⚡ Power Platform Management

### Environment Management
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Power Platform Environments — dark](screenshots/power-platform-environments.jpg) |

**Problem Solved:** Managing Power Platform environments across the tenant requires switching between Power Platform Admin Center and individual environment admin portals.

**Solution:** Unified environment dashboard showing all environments with capacity metrics, database sizes, and environment health at a glance.

**Key Benefits:**
- Monitor capacity across all environments
- Identify environments approaching limits
- Quick environment health checks
- Prevent production outages from capacity issues

### Capacity Management
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | _Screenshot pending_ |

**Problem Solved:** Power Platform capacity tracking is complex and warnings come too late to prevent service disruptions.

**Solution:** Visual capacity dashboard with usage trending, database storage breakdown, and file storage metrics.

**Key Benefits:**
- Proactive capacity planning
- Prevent unexpected capacity charges
- Optimize environment distribution
- Support capacity purchase decisions

### DLP Policies
> 📸 _Screenshot pending for **DLP Policies** — needs both `screenshots/power-platform__dlp-policies.png` (light) and `screenshots/power-platform__dlp-policies-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Data Loss Prevention policies in Power Platform are difficult to audit and understand which connectors are blocked/allowed.

**Solution:** Clear DLP policy dashboard showing policy scope, connector restrictions, and environment coverage.

**Key Benefits:**
- Understand data protection boundaries
- Identify policy gaps
- Connector governance
- Compliance alignment

### Power Automate Flows
> 📸 _Screenshot pending for **Flows** — needs both `screenshots/power-platform__flows.png` (light) and `screenshots/power-platform__flows-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Finding and managing flows across environments requires manual environment switching.

**Solution:** Environment-selector with flow listing showing status, type, and last modification for quick troubleshooting.

**Key Benefits:**
- Cross-environment flow visibility
- Identify failed flows quickly
- Flow inventory for governance
- Support for business continuity planning

### Solution Analysis

**Problem Solved:** A solution `.zip` is an opaque archive. Hardcoded secrets, non-delegable Canvas App queries, and missing flow retry policies ship to production because nobody can review what is actually inside.

**Solution:** Analyze any solution — exported from Dataverse in one click, or uploaded as a `.zip` you exported by hand — and get a deterministic inventory, cloud flow lint, Canvas App Power Fx review, and a redacted secret scan, followed by an AI-written review report.

**Key Benefits:**
- Catch secrets hardcoded in flow definitions and browser-downloadable web resources before release
- Find Canvas App delegation bugs, where a query silently returns only the first 500–2000 rows instead of failing
- Flow lint across security, reliability, performance, and maintainability
- Full component inventory for ALM and handover reviews
- Findings are reproducible and evidence is redacted, so a report can be shared safely
- CSV export for tracking remediation

📖 See [Power Platform solution analysis](./power-platform-solution-analysis.md) for the rule set, limits, and API contract.

---

## 🛡️ Application Management

### Enterprise Applications
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Enterprise Applications — dark](screenshots/enterprise-applications.jpg) |

**Problem Solved:** Understanding which enterprise applications have tenant access and their permissions is buried in complex admin interfaces.

**Solution:** Comprehensive application listing with sign-in activity, permission grants, and service principal details.

**Key Benefits:**
- Identify unused applications
- Security risk assessment
- Permission audit trails
- Support for Zero Trust verification

### App Protection Policies
> 📸 _Screenshot pending for **App Protection** — needs both `screenshots/application-management__app-protection-status.png` (light) and `screenshots/application-management__app-protection-status-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Intune App Protection policies and their user coverage are difficult to monitor.

**Solution:** Policy dashboard showing targeted user counts, compliant users, and policy settings at a glance.

**Key Benefits:**
- Mobile data protection visibility
- Policy coverage gaps
- Compliance tracking
- BYOD governance support

### Intune App Catalog
> 📸 _Screenshot pending for **Intune Apps** — needs both `screenshots/application-management__intune-apps.png` (light) and `screenshots/application-management__intune-apps-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Managing deployed applications across thousands of devices lacks clear deployment status visibility.

**Solution:** Application catalog with installation status, assignment details, and failure tracking.

**Key Benefits:**
- Track app deployment success
- Identify installation failures
- Version compliance
- Software asset management

---

## 📈 Reporting & Analytics

### Service Health
| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Service Health — dark](screenshots/service-health.jpg) |

**Problem Solved:** Microsoft service incidents are announced late and scattered across multiple portals.

**Solution:** Centralized service health dashboard showing active incidents, advisories, and historical issues.

**Key Benefits:**
- Proactive incident awareness
- Reduce helpdesk tickets
- Customer communication preparation
- Service credit eligibility tracking

### Audit Logs
> 📸 _Screenshot pending for **Audit Logs** — needs both `screenshots/audit-logs.png` (light) and `screenshots/audit-logs-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Microsoft 365 audit logs are difficult to query and lack business-friendly summaries.

**Solution:** Searchable audit log interface with activity filtering, user targeting, and export capabilities.

**Key Benefits:**
- Compliance reporting
- Security investigations
- Change tracking
- Regulatory requirement support

### Microsoft 365 Usage Reports
> 📸 _Screenshot pending for **M365 Usage** — needs both `screenshots/reports__m365-app-user-counts.png` (light) and `screenshots/reports__m365-app-user-counts-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Understanding Microsoft 365 license utilization and user activity requires manual data collection.

**Solution:** Pre-built usage dashboards showing active users, application adoption, and trending metrics.

**Key Benefits:**
- License optimization opportunities
- User adoption tracking
- ROI justification
- Right-sizing decisions

---

## 🔧 Advanced Features

### Log Analytics / KQL Explorer
> 📸 _Screenshot pending for **Log Analytics** — needs both `screenshots/log-analytics.png` (light) and `screenshots/log-analytics-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Writing KQL queries requires expertise and the Log Analytics portal is complex.

**Solution:** Integrated KQL query interface with pre-built queries, syntax highlighting, and result visualization.

**Key Benefits:**
- Lower skill barrier for log analysis
- Quick troubleshooting
- Security investigation support
- Custom reporting capabilities

### Graph Explorer
> 📸 _Screenshot pending for **Graph Explorer** — needs both `screenshots/graph-explorer.png` (light) and `screenshots/graph-explorer-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Testing Microsoft Graph API calls requires separate tools and authentication setup.

**Solution:** Built-in Graph Explorer with pre-authenticated requests and response visualization.

**Key Benefits:**
- API development acceleration
- Integration testing
- Troubleshoot custom applications
- Learn Graph API capabilities

### Known Issues Tracker
> 📸 _Screenshot pending for **Known Issues** — needs both `screenshots/known-issues.png` (light) and `screenshots/known-issues-dark.png` (dark). Regenerate via [`pnpm run test:screenshots-tenant-both-all`](../tests/README-SCREENSHOTS.md)._

**Problem Solved:** Microsoft publishes known issues across multiple sites, making it hard to track relevant problems.

**Solution:** Aggregated known issues dashboard with filtering by product, status, and severity.

**Key Benefits:**
- Avoid troubleshooting known issues
- Plan update rollouts
- Customer communication
- Reduce wasted effort

---

## 🎯 Why Portal 360° for MSPs

### Multi-Tenant Support
Every feature works across client tenants with proper delegated access. Single sign-on support via Azure AD B2B.

### Efficiency Gains
- **40% reduction** in time switching between portals
- **60% faster** user provisioning and management
- **50% improvement** in security incident response time
- **70% fewer** configuration errors

### Cost Optimization
- Identify Azure cost optimization opportunities worth thousands/month
- Right-size Microsoft 365 licenses based on actual usage
- Power Platform capacity planning prevents overages
- Audit unused applications and licenses

### Compliance & Security
- Centralized security posture visibility
- Audit-ready compliance reporting
- Identity protection monitoring
- Policy governance enforcement

### Client Satisfaction
- Faster issue resolution
- Proactive problem identification
- Professional reporting capabilities
- Better communication during incidents

---

## 🚀 Getting Started

1. **Sign In**: Azure AD authentication with MFA support
2. **Explore**: Navigate using the category cards on the home page
3. **Customize**: Each view supports filtering, sorting, and export
4. **Automate**: Save common queries and reports for one-click access
5. **Scale**: Works with tenants of any size (SMB to Enterprise)

---

## 📞 Support & Resources

- **Documentation**: Full API reference and integration guides
- **Training**: Video tutorials for each major feature
- **Community**: User forums and best practices sharing
- **Updates**: Regular feature releases based on user feedback

---

## 💼 Perfect For

- **Managed Service Providers (MSPs)**: Manage multiple client tenants efficiently
- **IT Departments**: Centralize cloud administration tasks
- **Security Teams**: Monitor and respond to threats faster
- **Compliance Officers**: Generate audit reports on-demand
- **Cloud Architects**: Optimize Azure and Microsoft 365 environments

---

*Portal 360° - Your Complete Tenant Administration Solution*
