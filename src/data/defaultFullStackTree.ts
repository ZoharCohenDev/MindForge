import type { SeedNode } from "../types";

export const defaultFullStackTree: SeedTopic = {
  title: "Full Stack Development",
  summary: "The complete Full Stack learning tree.",
  children: [
    {
      title: "1. Internet & Web Fundamentals",
      summary: "",
      children: [
        {
          title: "How the Web Works",
          summary: "",
          children: [
            { title: "איך האינטרנט עובד", summary: "", children: [] },
            { title: "HTTP", summary: "", children: [] },
            { title: "HTTPS", summary: "", children: [] },
            { title: "Request lifecycle", summary: "", children: [] },
            { title: "Response lifecycle", summary: "", children: [] },
            { title: "Status codes", summary: "", children: [] },
            { title: "Headers", summary: "", children: [] },
            { title: "Cookies", summary: "", children: [] },
            { title: "Sessions", summary: "", children: [] },
            { title: "LocalStorage", summary: "", children: [] },
            { title: "SessionStorage", summary: "", children: [] },
            { title: "CORS", summary: "", children: [] },
            { title: "DNS", summary: "", children: [] },
            { title: "Domains", summary: "", children: [] },
            { title: "SSL", summary: "", children: [] },
            { title: "TLS", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "2. JavaScript",
      summary: "",
      children: [
        {
          title: "JavaScript Fundamentals",
          summary: "",
          children: [
            { title: "JavaScript basics ✔", summary: "", children: [] },
            { title: "JavaScript syntax ✔", summary: "", children: [] },
            { title: "let / const ✔", summary: "", children: [] },
            { title: "Data types", summary: "", children: [] },
            { title: "Truthy / falsy", summary: "", children: [] },
            { title: "Operators", summary: "", children: [] },
            { title: "Control flow", summary: "", children: [] },
            { title: "Functions", summary: "", children: [] },
            { title: "Arrow functions ✔", summary: "", children: [] },
            { title: "Arrays", summary: "", children: [] },
            { title: "Objects", summary: "", children: [] },
            { title: "Destructuring ✔", summary: "", children: [] },
            { title: "Spread operator ✔", summary: "", children: [] },
            { title: "Rest operator ✔", summary: "", children: [] },
            { title: "Array methods (map, filter, reduce) ✔", summary: "", children: [] },
            { title: "Object methods", summary: "", children: [] },
            { title: "Immutability", summary: "", children: [] },
            { title: "Optional chaining", summary: "", children: [] },
            { title: "Nullish coalescing", summary: "", children: [] }
          ]
        },
        {
          title: "JavaScript Advanced Concepts",
          summary: "",
          children: [
            { title: "Closures", summary: "", children: [] },
            { title: "Scope", summary: "", children: [] },
            { title: "Hoisting", summary: "", children: [] },
            { title: "Call stack", summary: "", children: [] },
            { title: "Event loop", summary: "", children: [] },
            { title: "Promises ✔", summary: "", children: [] },
            { title: "async / await ✔", summary: "", children: [] },
            { title: "Error handling", summary: "", children: [] },
            { title: "try / catch", summary: "", children: [] },
            { title: "Custom errors", summary: "", children: [] },
            { title: "Memory (heap / stack)", summary: "", children: [] },
            { title: "References vs values", summary: "", children: [] },
            { title: "Shallow copy", summary: "", children: [] },
            { title: "Deep copy", summary: "", children: [] },
            { title: "Debounce", summary: "", children: [] },
            { title: "Throttle", summary: "", children: [] },
            { title: "Currying", summary: "", children: [] },
            { title: "Functional programming basics", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "3. TypeScript",
      summary: "",
      children: [
        {
          title: "TypeScript Fundamentals",
          summary: "",
          children: [
            { title: "TypeScript basics ✔", summary: "", children: [] },
            { title: "Typing variables", summary: "", children: [] },
            { title: "Typing functions", summary: "", children: [] },
            { title: "Interfaces ✔", summary: "", children: [] },
            { title: "Types ✔", summary: "", children: [] },
            { title: "Union types", summary: "", children: [] },
            { title: "Intersection types", summary: "", children: [] },
            { title: "Generics", summary: "", children: [] },
            { title: "Type narrowing", summary: "", children: [] },
            { title: "Utility types", summary: "", children: [] },
            { title: "Enums", summary: "", children: [] },
            { title: "Type inference", summary: "", children: [] },
            { title: "Strict mode", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "4. HTML & CSS",
      summary: "",
      children: [
        {
          title: "HTML",
          summary: "",
          children: [
            { title: "HTML5 ✔", summary: "", children: [] },
            { title: "Semantic HTML", summary: "", children: [] },
            { title: "Forms", summary: "", children: [] },
            { title: "Inputs", summary: "", children: [] },
            { title: "Accessibility basics", summary: "", children: [] },
            { title: "ARIA", summary: "", children: [] }
          ]
        },
        {
          title: "CSS",
          summary: "",
          children: [
            { title: "CSS basics ✔", summary: "", children: [] },
            { title: "Box model", summary: "", children: [] },
            { title: "Flexbox", summary: "", children: [] },
            { title: "CSS Grid", summary: "", children: [] },
            { title: "Responsive design", summary: "", children: [] },
            { title: "Media queries", summary: "", children: [] },
            { title: "CSS variables", summary: "", children: [] },
            { title: "Animations", summary: "", children: [] },
            { title: "Transitions", summary: "", children: [] },
            { title: "Tailwind", summary: "", children: [] },
            { title: "CSS Modules", summary: "", children: [] },
            { title: "SCSS", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "5. Git & Developer Tools",
      summary: "",
      children: [
        {
          title: "Git",
          summary: "",
          children: [
            { title: "Git basics ✔", summary: "", children: [] },
            { title: "Git branches", summary: "", children: [] },
            { title: "Git merge", summary: "", children: [] },
            { title: "Git rebase", summary: "", children: [] },
            { title: "Resolve conflicts", summary: "", children: [] },
            { title: "Git tags", summary: "", children: [] },
            { title: "GitHub", summary: "", children: [] },
            { title: "Pull Requests", summary: "", children: [] },
            { title: "Code reviews", summary: "", children: [] }
          ]
        },
        {
          title: "Editor & Debugging Tools",
          summary: "",
          children: [
            { title: "VS Code", summary: "", children: [] },
            { title: "VS Code extensions", summary: "", children: [] },
            { title: "Debugger", summary: "", children: [] },
            { title: "Chrome DevTools", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "6. React",
      summary: "",
      children: [
        {
          title: "React Fundamentals",
          summary: "",
          children: [
            { title: "React basics ✔", summary: "", children: [] },
            { title: "JSX ✔", summary: "", children: [] },
            { title: "Functional components ✔", summary: "", children: [] },
            { title: "Props ✔", summary: "", children: [] },
            { title: "State ✔", summary: "", children: [] },
            { title: "useState ✔", summary: "", children: [] },
            { title: "useEffect ✔", summary: "", children: [] },
            { title: "useReducer", summary: "", children: [] },
            { title: "useContext", summary: "", children: [] },
            { title: "useRef", summary: "", children: [] },
            { title: "useMemo", summary: "", children: [] },
            { title: "useCallback", summary: "", children: [] },
            { title: "useLayoutEffect", summary: "", children: [] },
            { title: "useImperativeHandle", summary: "", children: [] },
            { title: "useId", summary: "", children: [] },
            { title: "useTransition", summary: "", children: [] },
            { title: "useDeferredValue", summary: "", children: [] },
            { title: "forwardRef", summary: "", children: [] },
            { title: "memo", summary: "", children: [] },
            { title: "Component lifecycle", summary: "", children: [] }
          ]
        },
        {
          title: "React Patterns",
          summary: "",
          children: [
            { title: "Controlled components", summary: "", children: [] },
            { title: "Uncontrolled components", summary: "", children: [] },
            { title: "Forms handling", summary: "", children: [] },
            { title: "Conditional rendering", summary: "", children: [] },
            { title: "Lists & keys", summary: "", children: [] },
            { title: "Lifting state", summary: "", children: [] },
            { title: "Props drilling", summary: "", children: [] },
            { title: "Composition", summary: "", children: [] },
            { title: "Custom hooks", summary: "", children: [] },
            { title: "React performance optimization", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "7. State Management & Data Fetching",
      summary: "",
      children: [
        {
          title: "Redux",
          summary: "",
          children: [
            { title: "Redux basics", summary: "", children: [] },
            { title: "Redux Toolkit", summary: "", children: [] },
            { title: "Store", summary: "", children: [] },
            { title: "Reducers", summary: "", children: [] },
            { title: "Actions", summary: "", children: [] },
            { title: "Middleware", summary: "", children: [] },
            { title: "Async actions", summary: "", children: [] },
            { title: "Redux with TypeScript", summary: "", children: [] }
          ]
        },
        {
          title: "Server State",
          summary: "",
          children: [
            { title: "React Query / TanStack Query", summary: "", children: [] },
            { title: "Server state", summary: "", children: [] },
            { title: "Client state", summary: "", children: [] },
            { title: "Caching", summary: "", children: [] },
            { title: "Pagination handling", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "8. Next.js",
      summary: "",
      children: [
        {
          title: "Next.js Core",
          summary: "",
          children: [
            { title: "Next.js basics", summary: "", children: [] },
            { title: "Pages Router", summary: "", children: [] },
            { title: "App Router", summary: "", children: [] },
            { title: "Server Components", summary: "", children: [] },
            { title: "Client Components", summary: "", children: [] },
            { title: "SSR", summary: "", children: [] },
            { title: "SSG", summary: "", children: [] },
            { title: "ISR", summary: "", children: [] },
            { title: "Routing", summary: "", children: [] },
            { title: "Dynamic routes", summary: "", children: [] },
            { title: "API Routes", summary: "", children: [] },
            { title: "Middleware", summary: "", children: [] },
            { title: "SEO", summary: "", children: [] },
            { title: "Environment variables (Next)", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "9. Frontend Testing",
      summary: "",
      children: [
        {
          title: "Testing Tools",
          summary: "",
          children: [
            { title: "Frontend testing", summary: "", children: [] },
            { title: "Jest", summary: "", children: [] },
            { title: "Vitest", summary: "", children: [] },
            { title: "React Testing Library", summary: "", children: [] },
            { title: "Playwright", summary: "", children: [] },
            { title: "Cypress", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "10. Node.js Ecosystem",
      summary: "",
      children: [
        {
          title: "Node Fundamentals",
          summary: "",
          children: [
            { title: "Node.js basics ✔", summary: "", children: [] },
            { title: "Node runtime", summary: "", children: [] },
            { title: "npm", summary: "", children: [] },
            { title: "yarn", summary: "", children: [] },
            { title: "pnpm", summary: "", children: [] },
            { title: "nvm", summary: "", children: [] },
            { title: "Environment variables", summary: "", children: [] },
            { title: "dotenv", summary: "", children: [] },
            { title: "nodemon", summary: "", children: [] },
            { title: "ts-node", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "11. Express & REST APIs",
      summary: "",
      children: [
        {
          title: "Express",
          summary: "",
          children: [
            { title: "Express ✔", summary: "", children: [] },
            { title: "Routing", summary: "", children: [] },
            { title: "Middleware", summary: "", children: [] },
            { title: "Error middleware", summary: "", children: [] }
          ]
        },
        {
          title: "REST APIs",
          summary: "",
          children: [
            { title: "REST principles ✔", summary: "", children: [] },
            { title: "REST API design", summary: "", children: [] },
            { title: "Pagination", summary: "", children: [] },
            { title: "Filtering", summary: "", children: [] },
            { title: "Sorting", summary: "", children: [] },
            { title: "API versioning", summary: "", children: [] }
          ]
        },
        {
          title: "API Tools",
          summary: "",
          children: [
            { title: "Postman", summary: "", children: [] },
            { title: "Insomnia", summary: "", children: [] },
            { title: "curl", summary: "", children: [] },
            { title: "httpie", summary: "", children: [] },
            { title: "ngrok", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "12. NestJS",
      summary: "",
      children: [
        {
          title: "NestJS Core",
          summary: "",
          children: [
            { title: "NestJS basics", summary: "", children: [] },
            { title: "Controllers", summary: "", children: [] },
            { title: "Providers", summary: "", children: [] },
            { title: "Services", summary: "", children: [] },
            { title: "Modules", summary: "", children: [] },
            { title: "Dependency Injection", summary: "", children: [] },
            { title: "Pipes", summary: "", children: [] },
            { title: "Guards", summary: "", children: [] },
            { title: "Interceptors", summary: "", children: [] },
            { title: "NestJS with TypeScript", summary: "", children: [] },
            { title: "NestJS Auth", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "13. Authentication & Authorization",
      summary: "",
      children: [
        {
          title: "Authentication",
          summary: "",
          children: [
            { title: "Authentication fundamentals", summary: "", children: [] },
            { title: "Password hashing", summary: "", children: [] },
            { title: "bcrypt / bcryptjs", summary: "", children: [] },
            { title: "JWT", summary: "", children: [] },
            { title: "Refresh tokens", summary: "", children: [] },
            { title: "Sessions vs tokens", summary: "", children: [] },
            { title: "OAuth", summary: "", children: [] }
          ]
        },
        {
          title: "Authorization",
          summary: "",
          children: [
            { title: "Authorization", summary: "", children: [] },
            { title: "Roles", summary: "", children: [] },
            { title: "Permissions", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "14. MongoDB",
      summary: "",
      children: [
        {
          title: "MongoDB Core",
          summary: "",
          children: [
            { title: "MongoDB basics ✔", summary: "", children: [] },
            { title: "Collections", summary: "", children: [] },
            { title: "Documents", summary: "", children: [] },
            { title: "Schema design", summary: "", children: [] },
            { title: "Indexes", summary: "", children: [] },
            { title: "Aggregations", summary: "", children: [] },
            { title: "Mongoose", summary: "", children: [] },
            { title: "MongoDB Compass", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "15. SQL & PostgreSQL",
      summary: "",
      children: [
        {
          title: "SQL Fundamentals",
          summary: "",
          children: [
            { title: "SQL fundamentals", summary: "", children: [] },
            { title: "PostgreSQL", summary: "", children: [] },
            { title: "Tables", summary: "", children: [] },
            { title: "Relationships", summary: "", children: [] },
            { title: "Primary keys", summary: "", children: [] },
            { title: "Foreign keys", summary: "", children: [] },
            { title: "Joins", summary: "", children: [] },
            { title: "Indexes", summary: "", children: [] },
            { title: "Transactions", summary: "", children: [] },
            { title: "ACID", summary: "", children: [] },
            { title: "Isolation levels", summary: "", children: [] },
            { title: "Query optimization", summary: "", children: [] },
            { title: "EXPLAIN", summary: "", children: [] },
            { title: "Migrations", summary: "", children: [] },
            { title: "Seeding", summary: "", children: [] },
            { title: "Connection pooling", summary: "", children: [] },
            { title: "pgAdmin", summary: "", children: [] },
            { title: "DBeaver", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "16. Prisma ORM",
      summary: "",
      children: [
        {
          title: "Prisma",
          summary: "",
          children: [
            { title: "Prisma ORM", summary: "", children: [] },
            { title: "Prisma schema", summary: "", children: [] },
            { title: "Relations", summary: "", children: [] },
            { title: "Prisma migrations", summary: "", children: [] },
            { title: "Prisma Client", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "17. File Uploads, Storage & Media",
      summary: "",
      children: [
        {
          title: "Files & Images",
          summary: "",
          children: [
            { title: "File uploads", summary: "", children: [] },
            { title: "Multipart forms", summary: "", children: [] },
            { title: "Image handling", summary: "", children: [] },
            { title: "Cloud storage", summary: "", children: [] },
            { title: "AWS S3", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "18. Caching, Queues & Real-Time",
      summary: "",
      children: [
        {
          title: "Caching",
          summary: "",
          children: [
            { title: "Redis", summary: "", children: [] },
            { title: "Redis CLI", summary: "", children: [] },
            { title: "Caching strategies", summary: "", children: [] },
            { title: "Cache invalidation", summary: "", children: [] }
          ]
        },
        {
          title: "Background Processing",
          summary: "",
          children: [
            { title: "Background jobs", summary: "", children: [] },
            { title: "Queues", summary: "", children: [] },
            { title: "BullMQ", summary: "", children: [] },
            { title: "RabbitMQ", summary: "", children: [] }
          ]
        },
        {
          title: "Real-Time Communication",
          summary: "",
          children: [
            { title: "WebSockets", summary: "", children: [] },
            { title: "Socket.io", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "19. Security",
      summary: "",
      children: [
        {
          title: "Application Security",
          summary: "",
          children: [
            { title: "Security basics", summary: "", children: [] },
            { title: "OWASP Top 10", summary: "", children: [] },
            { title: "XSS", summary: "", children: [] },
            { title: "CSRF", summary: "", children: [] },
            { title: "SQL Injection", summary: "", children: [] },
            { title: "Input validation", summary: "", children: [] },
            { title: "zod / joi", summary: "", children: [] },
            { title: "class-validator", summary: "", children: [] },
            { title: "Rate limiting", summary: "", children: [] },
            { title: "helmet", summary: "", children: [] },
            { title: "Security headers", summary: "", children: [] },
            { title: "HTTPS everywhere", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "20. DevOps, Linux & Infrastructure",
      summary: "",
      children: [
        {
          title: "Containers",
          summary: "",
          children: [
            { title: "Docker", summary: "", children: [] },
            { title: "Dockerfile", summary: "", children: [] },
            { title: "Docker Compose", summary: "", children: [] },
            { title: "Docker CLI", summary: "", children: [] }
          ]
        },
        {
          title: "Linux & Networking",
          summary: "",
          children: [
            { title: "Linux basics", summary: "", children: [] },
            { title: "Filesystem", summary: "", children: [] },
            { title: "Permissions", summary: "", children: [] },
            { title: "SSH", summary: "", children: [] },
            { title: "Nginx", summary: "", children: [] },
            { title: "Reverse proxy", summary: "", children: [] }
          ]
        },
        {
          title: "CI/CD",
          summary: "",
          children: [
            { title: "CI/CD basics", summary: "", children: [] },
            { title: "GitHub Actions", summary: "", children: [] },
            { title: "Build pipelines", summary: "", children: [] },
            { title: "Test pipelines", summary: "", children: [] },
            { title: "Deploy pipelines", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "21. Cloud & Hosting",
      summary: "",
      children: [
        {
          title: "Cloud Fundamentals",
          summary: "",
          children: [
            { title: "Cloud fundamentals", summary: "", children: [] },
            { title: "AWS overview", summary: "", children: [] },
            { title: "EC2", summary: "", children: [] },
            { title: "RDS", summary: "", children: [] },
            { title: "IAM", summary: "", children: [] },
            { title: "CloudFront", summary: "", children: [] }
          ]
        },
        {
          title: "Deployment Platforms",
          summary: "",
          children: [
            { title: "Vercel", summary: "", children: [] },
            { title: "Netlify", summary: "", children: [] },
            { title: "Render", summary: "", children: [] },
            { title: "Fly.io", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "22. Monitoring, Observability & Documentation",
      summary: "",
      children: [
        {
          title: "Observability",
          summary: "",
          children: [
            { title: "Monitoring", summary: "", children: [] },
            { title: "Logging", summary: "", children: [] },
            { title: "Sentry", summary: "", children: [] },
            { title: "Metrics", summary: "", children: [] }
          ]
        },
        {
          title: "API Documentation",
          summary: "",
          children: [
            { title: "Swagger", summary: "", children: [] },
            { title: "OpenAPI", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "23. System Design & Scalability",
      summary: "",
      children: [
        {
          title: "System Design",
          summary: "",
          children: [
            { title: "System design basics", summary: "", children: [] },
            { title: "Scalability", summary: "", children: [] },
            { title: "Stateless services", summary: "", children: [] },
            { title: "Load balancers", summary: "", children: [] },
            { title: "Caching layers", summary: "", children: [] },
            { title: "Message queues", summary: "", children: [] },
            { title: "Monolith vs microservices", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "24. Performance",
      summary: "",
      children: [
        {
          title: "Performance Optimization",
          summary: "",
          children: [
            { title: "Performance optimization", summary: "", children: [] },
            { title: "Backend performance", summary: "", children: [] },
            { title: "Frontend performance", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "25. Production Readiness",
      summary: "",
      children: [
        {
          title: "Production & Operations",
          summary: "",
          children: [
            { title: "Feature flags", summary: "", children: [] },
            { title: "Graceful shutdown", summary: "", children: [] },
            { title: "Health checks", summary: "", children: [] },
            { title: "Readiness / liveness endpoints", summary: "", children: [] },
            { title: ".env.example", summary: "", children: [] },
            { title: "Domain setup", summary: "", children: [] },
            { title: "Production HTTPS", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "26. Engineering Practices",
      summary: "",
      children: [
        {
          title: "Code Quality",
          summary: "",
          children: [
            { title: "Clean code", summary: "", children: [] },
            { title: "Naming conventions", summary: "", children: [] },
            { title: "Refactoring", summary: "", children: [] },
            { title: "Backward compatibility", summary: "", children: [] },
            { title: "Semantic versioning", summary: "", children: [] }
          ]
        }
      ]
    },
    {
      title: "27. Full Product Lifecycle",
      summary: "",
      children: [
        {
          title: "End to End Product",
          summary: "",
          children: [
            { title: "Full end to end product", summary: "", children: [] },
            { title: "Build", summary: "", children: [] },
            { title: "Test", summary: "", children: [] },
            { title: "Deploy", summary: "", children: [] },
            { title: "Monitor", summary: "", children: [] },
            { title: "Maintain", summary: "", children: [] }
          ]
        }
      ]
    }
  ]
} as const;