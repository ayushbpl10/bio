export const PROFILE = {
  name: "Ayush Gupta",
  headline: "Senior Software Engineer | Microservices & Distributed Architecture | Enterprise Platforms & Integrations",
  company: "Dell Technologies",
  location: "India",
  followers: "4,414",
  connections: "500+",
  experienceYears: "10+",
  summary:
    "Distributed systems and platform engineer with a decade of production experience spanning enterprise observability, anomaly detection, cloud resiliency, and high-scale scheduling infrastructure. Led monolith-to-microservices migrations at Dell Technologies and delivered a flagship scheduling product for Google at Appointy.",
  topSkills: [
    "Go (Golang)",
    "Java & Spring Boot",
    "Microservices & Distributed Systems",
    "OpenTelemetry & Grafana",
    "AWS & Cloud Resiliency",
    "PostgreSQL",
    "Protobuf & OpenAPI",
    "OAuth / SSO & IAM",
    "Angular & TypeScript",
    ".NET Core",
    "Technical Leadership",
  ],
  pillars: [
    {
      title: "Global Product Delivery",
      badge: "Google Partnership",
      detail:
        "Served as Senior Developer delivering a flagship scheduling product for Google at Appointy, leading feature design, Go/Angular delivery, and continuous deployment pipelines.",
    },
    {
      title: "Architectural Modernization",
      badge: "Monolith -> Microservices",
      detail:
        "Led engineering initiatives at Dell Technologies to transition monolithic reporting architecture into independent, scalable microservices (MSR) within the PPDM ecosystem.",
    },
    {
      title: "Observability & Cyber Resiliency",
      badge: "OTel + Anomaly Engine",
      detail:
        "Spearheaded Grafana + OpenTelemetry telemetry pipelines and built PowerProtect Data Manager anomaly detection & automated threat signature upgrades.",
    },
    {
      title: "Ecosystem & Security Scale",
      badge: "10+ SaaS + OAuth/SSO",
      detail:
        "Directed integration engineering across 10+ major SaaS tools (Zapier, analytics, marketing pixels) and built OAuth/SSO systems across multi-tenant SaaS platforms.",
    },
    {
      title: "Engineering Mentorship",
      badge: "Tech Lead & Scrum",
      detail:
        "Tech Lead & Scrum Master guiding cross-functional pods and mentoring engineering interns at Dell to design and launch analytics dashboards for Cloud Snapshot Manager.",
    },
  ],
  traceSpans: [
    {
      id: "gateway",
      service: "api-gateway",
      operation: "OAuth 2.0 / SSO Multi-Tenant Auth",
      durationMs: 18,
      offsetPct: 0,
      widthPct: 16,
      stack: ["OAuth 2.0", "Google / LinkedIn / FB SSO", "REST"],
      impact:
        "Designed and implemented multi-tenant OAuth/SSO authentication pipelines securing next-generation SaaS scheduling and enterprise portals.",
    },
    {
      id: "scheduler",
      service: "scheduling-core",
      operation: "Google Scheduling Engine (SaaStack)",
      durationMs: 42,
      offsetPct: 12,
      widthPct: 32,
      stack: ["Go (Golang)", "Protobuf", "Angular", "PostgreSQL"],
      impact:
        "Engineered high-throughput, low-latency inter-service scheduling workflows and standardized OpenAPI/Swagger interfaces for Google-partnered delivery.",
    },
    {
      id: "snapshot",
      service: "csm-cloud-protect",
      operation: "AWS DynamoDB Global Tables Snapshot",
      durationMs: 64,
      offsetPct: 30,
      widthPct: 38,
      stack: ["Java", "Spring Boot", "AWS", "DDVE"],
      impact:
        "Spearheaded Cloud Snapshot Manager modernization, native AWS DynamoDB Global Tables automated snapshots, and Santorini Scale-Out capacity.",
    },
    {
      id: "anomaly",
      service: "ppdm-anomaly-engine",
      operation: "Asset Scan & Threat Signature Pipeline",
      durationMs: 51,
      offsetPct: 52,
      widthPct: 34,
      stack: ["Search Indexing", "Zero-Touch Signatures", "CDR Spring Boot"],
      impact:
        "Built customer-focused anomaly detection across PPDM releases, integrating high-throughput asset indexing and automated definition upgrade pipelines.",
    },
    {
      id: "telemetry",
      service: "msr-otel-collector",
      operation: "Grafana + OpenTelemetry Export",
      durationMs: 24,
      offsetPct: 76,
      widthPct: 24,
      stack: ["OpenTelemetry", "Grafana", "MSR Microservices"],
      impact:
        "Integrated Grafana via Microservice Reporting (MSR) into a unified observability dashboard with distributed traces and metrics.",
    },
  ],
  devWorkbench: [
    { name: "Go", category: "Language", icon: "go", color: "#00ADD8" },
    { name: "Java", category: "Language", icon: "java", color: "#EA2D2E" },
    { name: "TypeScript", category: "Language", icon: "ts", color: "#3178C6" },
    { name: "Python", category: "Language", icon: "python", color: "#3776AB" },
    { name: "Angular", category: "Framework", icon: "angular", color: "#DD0031" },
    { name: ".NET Core", category: "Runtime", icon: "dotnet", color: "#512BD4" },
    { name: "AWS", category: "Cloud", icon: "aws", color: "#FF9900" },
    { name: "Google Cloud", category: "Cloud", icon: "gcloud", color: "#4285F4" },
    { name: "OpenTelemetry", category: "Observability", icon: "otel", color: "#F5A800" },
    { name: "Grafana", category: "Observability", icon: "grafana", color: "#F46800" },
    { name: "PostgreSQL", category: "Database", icon: "postgres", color: "#336791" },
    { name: "Docker", category: "Containers", icon: "docker", color: "#2496ED" },
    { name: "Antigravity", category: "AI IDE", icon: "antigravity", color: "#A855F7" },
    { name: "VS Code", category: "IDE", icon: "vscode", color: "#007ACC" },
    { name: "IntelliJ IDEA", category: "IDE", icon: "intellij", color: "#FE315D" },
    { name: "GoLand", category: "IDE", icon: "goland", color: "#087CFA" },
    { name: "WebStorm", category: "IDE", icon: "webstorm", color: "#00CDD7" },
    { name: "Windsurf", category: "AI IDE", icon: "windsurf", color: "#06B6D4" },
    { name: "Devin & CLI", category: "AI Agent", icon: "devin", color: "#38BDF8" },
    { name: "Claude Code", category: "AI CLI", icon: "claude", color: "#D97757" },
    { name: "GitHub", category: "VCS / CI", icon: "github", color: "#8B949E" },
  ],
  skillsCatalog: [
    { name: "Go (Golang)", domain: "backend", level: "Core · 7+ yrs", icon: "go" },
    { name: "Java & Spring Boot", domain: "backend", level: "Core · 5+ yrs", icon: "java" },
    { name: "Microservices & Protobuf", domain: "backend", level: "Architecture", icon: "docker" },
    { name: "PostgreSQL & Query Tuning", domain: "backend", level: "Data Layer", icon: "postgres" },
    { name: ".NET Core / Web API", domain: "backend", level: "Platform", icon: "dotnet" },
    { name: "OpenTelemetry (OTel)", domain: "observability", level: "Telemetry", icon: "otel" },
    { name: "Grafana & MSR Dashboards", domain: "observability", level: "Observability", icon: "grafana" },
    { name: "Anomaly & Threat Scanning", domain: "observability", level: "Security", icon: "terminal" },
    { name: "AWS & Cloud Disaster Recovery", domain: "observability", level: "Cloud", icon: "aws" },
    { name: "OAuth 2.0 / SSO / IAM", domain: "observability", level: "Identity", icon: "github" },
    { name: "Angular & TypeScript", domain: "frontend", level: "Frontend", icon: "angular" },
    { name: "RxJS & State Streams", domain: "frontend", level: "Frontend", icon: "ts" },
    { name: "OpenAPI / Swagger DX", domain: "frontend", level: "API Standards", icon: "terminal" },
    { name: "SaaS Integrations (Zapier/GTM)", domain: "frontend", level: "Ecosystem", icon: "docker" },
    { name: "Browser Extensions & IDEs", domain: "frontend", level: "Dev Tooling", icon: "vscode" },
  ],
  experience: [
    {
      company: "Dell Technologies",
      totalTenure: "5 yrs 1 mo",
      roles: [
        {
          title: "Senior Software Engineer",
          period: "Jun 2026 – Present · 6 mos",
          team: "Observability, Anomaly Detection & Cloud Resiliency Team",
          highlights: [
            {
              heading: "Enterprise Observability & Telemetry",
              detail:
                "Spearheaded reporting enhancements across the platform by integrating Grafana via MSR (Microservice Reporting) into a unified dashboard; leveraged OpenTelemetry (OTel) to instrument distributed traces, metrics, and deep telemetry pipelines.",
            },
            {
              heading: "Anomaly Detection Engine (PPDM)",
              detail:
                "Engineered customer-focused anomaly detection and scanning capabilities across multiple major PowerProtect Data Manager releases, safeguarding enterprise backup ecosystems from threat vectors and unauthorized changes.",
            },
            {
              heading: "Intelligent Asset Scanning",
              detail:
                "Enhanced asset-level anomaly scanning performance and accuracy by integrating and consuming a high-throughput search indexing engine.",
            },
            {
              heading: "Automated Threat Intelligence",
              detail:
                "Architected and rolled out automated definition upgrade pipelines, enabling real-time detection signatures and zero-touch security updates for customer environments.",
            },
            {
              heading: "Framework Modernization (Cloud Disaster Recovery)",
              detail:
                "Led the framework upgrade to modern Spring Boot versions for the CDR product, optimizing runtime performance, modernizing dependencies, and eliminating critical vulnerabilities.",
            },
            {
              heading: "Internal Developer Tooling",
              detail:
                "Developed a custom browser extension for the internal Ask Dell portal, automating repetitive workflows and boosting engineering productivity across teams.",
            },
          ],
          tags: ["OpenTelemetry", "Grafana", "Java", "Spring Boot", "PPDM", "CDR", "Anomaly Detection"],
        },
        {
          title: "Software Engineer 2",
          period: "Nov 2021 – Jun 2026 · 4 yrs 8 mos",
          team: "Tech Lead & Scrum Master · Data Protection & Cloud Security Team",
          highlights: [
            {
              heading: "Technical Leadership & Agile Delivery",
              detail:
                "Facilitated Agile/Scrum ceremonies for cross-functional engineering pods, removing blockers and driving predictable, on-time delivery across core data security roadmaps.",
            },
            {
              heading: "Cloud & Distributed Architecture",
              detail:
                "Engineered and scaled enterprise microservices in the Data Security domain utilizing Go (Golang), Java, Spring Boot, and PostgreSQL.",
            },
            {
              heading: "Cloud Snapshot Manager (CSM) Modernization",
              detail:
                "Spearheaded architecture enhancements for enterprise snapshot management; engineered native AWS integration to capture automated snapshots for DynamoDB Global Tables.",
            },
            {
              heading: "Next-Gen Product Development (Santorini Scale-Out)",
              detail:
                "Drove core development for the Santorini Scale-Out product initiative, expanding platform capacity and distributed throughput.",
            },
            {
              heading: "Data Mobility & Infrastructure",
              detail:
                "Enhanced the codebase for DDVE-based (Data Domain Virtual Edition) data mobility, improving efficiency, replication reliability, and enterprise-tier functionality.",
            },
            {
              heading: "Production Reliability & Observability",
              detail:
                "Managed production monitoring, proactive alerting, and rapid resolution of high-severity incidents to uphold strict availability and enterprise SLAs.",
            },
          ],
          tags: ["Go", "Java", "Spring Boot", "PostgreSQL", "AWS DynamoDB", "DDVE", "Scrum Master"],
        },
      ],
    },
    {
      company: "Appointy",
      totalTenure: "5 yrs 1 mo",
      roles: [
        {
          title: "Senior Software Engineer",
          period: "Jan 2020 – Nov 2021 · 1 yr 11 mos",
          team: "Core Platform & Scheduling Infrastructure Team",
          highlights: [
            {
              heading: "Google Integration & Product Engineering",
              detail:
                "Engineered end-to-end features for a high-scale scheduling product built for Google, leveraging Go (Golang) on the backend and Angular on the frontend.",
            },
            {
              heading: "Core Microservices Architecture",
              detail:
                "Developed mission-critical services and platform modules on Appointy's core SaaStack framework, implementing Protocol Buffers (Protobuf) and Go for high-throughput, low-latency inter-service communication.",
            },
            {
              heading: "API Standards & Developer Experience",
              detail:
                "Designed standardized RESTful interfaces and established automated documentation workflows using Swagger/OpenAPI, significantly accelerating client onboarding and internal integration testing.",
            },
          ],
          tags: ["Go", "Protobuf", "Angular", "SaaStack", "Swagger/OpenAPI", "Google Delivery"],
        },
        {
          title: "Software Engineer",
          period: "Jun 2018 – Jan 2020 · 1 yr 8 mos",
          team: "Integrations & Cloud Platform Team",
          highlights: [
            {
              heading: "Enterprise Integrations Ecosystem",
              detail:
                "Engineered third-party integrations for Appointy 9 using .NET Core and Angular 2+, connecting Zapier, Google Analytics, Google Tag Manager, and Facebook Page Share to automate user workflows and campaign attribution.",
            },
            {
              heading: "Google-Partnered Product Development",
              detail:
                "Built resilient backend REST APIs using Go (Golang) to power real-time scheduling infrastructure tailored for Google integration.",
            },
            {
              heading: "Database Architecture & Optimization",
              detail:
                "Designed robust database routines, stored procedures, and triggers in PostgreSQL to maintain data integrity, enforce business constraints, and optimize complex transactional queries.",
            },
          ],
          tags: [".NET Core", "Angular 2+", "Go", "PostgreSQL", "Zapier", "GTM"],
        },
        {
          title: "Technical Intern",
          period: "Nov 2016 – May 2018 · 1 yr 7 mos",
          team: "Full-Stack Web Development Engineering Team",
          highlights: [
            {
              heading: "Modern Frontend Architecture",
              detail:
                "Engineered responsive, modular user interfaces using Angular 4+, TypeScript, JavaScript, and jQuery, implementing reactive asynchronous state management and event streams with RxJS.",
            },
            {
              heading: "Backend API & Service Engineering",
              detail:
                "Developed robust RESTful APIs and server-side web modules utilizing .NET Core (MVC & Web API) and legacy ASP.NET, ensuring seamless frontend-to-backend data exchange.",
            },
            {
              heading: "Full-Stack Feature Delivery",
              detail:
                "Built end-to-end web features following clean architecture and MVC design patterns, taking requirements from initial UI views through business logic and controller layers.",
            },
          ],
          tags: ["Angular 4+", "TypeScript", "RxJS", ".NET Core", "ASP.NET"],
        },
      ],
    },
  ],
  sessionTopics: [
    {
      id: "system-design",
      title: "Microservices & System Design",
      subtitle: "Monolith-to-microservices, Go/Java scale-out, Protobuf & API architecture",
    },
    {
      id: "observability",
      title: "Observability & Cloud Resiliency",
      subtitle: "OpenTelemetry pipelines, Grafana dashboards, incident readiness & AWS",
    },
    {
      id: "career-prep",
      title: "Backend Career & Interview Prep",
      subtitle: "Senior SDE growth, mock system design, resume & architecture review",
    },
    {
      id: "integrations-auth",
      title: "Integrations, OAuth/SSO & SaaS",
      subtitle: "Multi-tenant IAM, third-party SaaS webhooks, PostgreSQL optimization",
    },
  ],
  // Time slots in Asia/Kolkata (IST). Hour & minute are 24h IST (Tuesdays only, 6:00 PM IST).
  timeSlots: {
    tuesdayOnly: true,
    slots: [
      { id: "18:00", hour: 18, minute: 0, label: "6:00 PM – 7:00 PM IST" },
    ],
  },
};
