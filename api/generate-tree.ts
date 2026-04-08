/**
 * Vercel Serverless Function — AI Tree Generator (Staged Recursive)
 *
 * POST /api/generate-tree
 * Body: { careerGoal: string }
 *
 * When OPENAI_API_KEY is set, uses a multi-stage approach:
 *   1. Generate top-level technical domains for the role
 *   2. Expand each domain into concept-level children (parallel)
 *   3. Validate the tree and refine weak branches
 *
 * When OPENAI_API_KEY is absent, returns a structured mock for local dev.
 */

export type { SeedNode, GeneratedTreePayload } from './lib/types.js';

import type { GeneratedTreePayload } from './lib/types.js';
import { generateTreeStaged } from './lib/treeGenerator.js';

/** @deprecated — kept for backward compat; generation now uses staged prompts. */
export function buildTreePrompt(careerGoal: string): string {
  return `You are generating a deeply detailed professional knowledge tree for a learning platform.

This is NOT a generic roadmap.
This is NOT a high-level outline.
This is NOT a curriculum summary.

Your job is to produce an extremely granular, deeply hierarchical tree of knowledge for a specific career goal.

ROLE: ${careerGoal}

PRIMARY GOAL:
Generate a tree that breaks the ROLE into real domains, subdomains, concepts, sub-concepts, implementation topics, edge cases, and practical skills.

The result must feel like:
- a senior engineer's internal knowledge map
- a university curriculum broken into atomic topics
- a production-ready learning tree
- a system that could support notes, progress tracking, and topic-by-topic study

STRICT RULES:

1. NO GENERIC HEADINGS
Do NOT use generic section titles such as: Foundations, Core Concepts, Basics, Intermediate, Advanced, Hands-on Practice, Career Growth, Tools Overview, Best Practices, Guided Projects — unless they are highly specific and nested under a real technical domain.

2. DOMAIN-FIRST STRUCTURE
Identify the REAL knowledge domains required for the ROLE. Each domain must be specific to the role.
Examples:
- Full Stack Developer → Internet, Browser, HTML, CSS, JavaScript, TypeScript, React, State Management, Backend, APIs, Authentication, Authorization, SQL, NoSQL, Caching, Testing, CI/CD, Deployment, Security, Performance
- AI Engineer → Linear Algebra, Calculus, Probability, Statistics, Python, Data Processing, Machine Learning, Optimization, Deep Learning, CNNs, RNNs, Transformers, NLP, Computer Vision, Training, Evaluation, MLOps, Deployment
- DevOps Engineer → Linux, Shell, Networking, Processes, Docker, Containers, Kubernetes, CI/CD, Infrastructure as Code, Cloud, Monitoring, Logging, Security, Reliability, Incident Response
- Data Scientist → Statistics, Probability, Python, Pandas, SQL, Data Cleaning, Exploratory Data Analysis, Visualization, Feature Engineering, Machine Learning, Experimentation, A/B Testing, Deployment, Communication

3. EXTREME GRANULARITY
Break every topic into smaller and smaller units. Do NOT stop at broad topics.

Bad: JavaScript, React, Databases
Good:
JavaScript
  → Variables → var, let, const, block scope, function scope, hoisting, temporal dead zone
  → Functions → declaration, expression, arrow functions, parameters vs arguments, default parameters, rest parameters, callbacks
  → Asynchronous JavaScript → call stack, web APIs, callback queue, event loop, promises, async/await, error handling in async flows

4. RECURSIVE DECOMPOSITION
For every major node, ask: What smaller topics compose this? What concepts must be understood before implementation? What implementation details matter? What edge cases or subtypes exist? What practical patterns are commonly used? Keep decomposing until you reach atomic learning units.

5. ATOMIC LEARNING UNITS
Each leaf or near-leaf node should ideally be small enough to study in 20–60 minutes. Each non-leaf node should still be specific and meaningful. Avoid giant umbrella nodes with no detailed children.

6. MINIMUM DEPTH
- Minimum depth: 5 levels where possible
- Preferred depth: 6–8 levels when the subject supports it
Do not stop early just because the top-level structure looks complete.

7. CONCEPT-LEVEL DETAIL
Include low-level concepts, not only categories. Acceptable low-level nodes: HTTP methods, status codes, JWT structure, SQL joins, indexes, normalization forms, closures, virtual DOM, React reconciliation, gradient descent, backpropagation, bias vs variance, tokenization, embeddings, Docker layers, Kubernetes pods, DNS resolution.

8. MULTI-AXIS SPLITTING
When relevant, split topics across multiple dimensions: definition, intuition, internal mechanics, syntax, implementation, common mistakes, debugging, performance, security, real-world usage, trade-offs, variants/subtypes.

Example:
Authentication → Definition, Authentication vs Authorization, Session-based auth, Token-based auth, JWT structure, Access token vs refresh token, Cookie storage, Local storage risks, CSRF, XSS implications, Role-based access control

9. ROLE-SPECIFIC ONLY
Do not generate a reusable generic structure. The tree must adapt to the ROLE. Different roles should produce clearly different trees.

10. NO FILLER
Do not include vague nodes that sound nice but teach nothing. Avoid: Industry Trends, Mindset, Soft Skills, General Practice — unless truly required and decomposed into concrete subtopics.

11. JOB-READINESS
The tree must include: theoretical concepts, practical skills, tools, implementation knowledge, debugging knowledge, production concerns, real-world architecture topics.

12. TREE QUALITY CHECK BEFORE OUTPUT
Before producing the final answer, internally verify: Is this too generic? Are there nodes that should be broken down further? Are there broad categories without enough children? Are there missing core technical domains? If yes, improve the tree before outputting.

13. OUTPUT FORMAT — STRICT JSON
Return strict JSON only. No markdown. No explanations. No comments.
Wrap the entire response in this envelope:
{
  "name": "<concise tree name, e.g. \\"Full Stack Developer Roadmap\\">",
  "description": "<one sentence describing this learning path>",
  "icon": "<single relevant emoji>",
  "tree": {
    "title": "${careerGoal}",
    "summary": "<one sentence overview of the full roadmap>",
    "children": [
      {
        "title": "<domain name>",
        "summary": "<one sentence>",
        "children": [ ... ]
      }
    ]
  }
}
Every node at every depth MUST include: title (string), summary (string, 1 sentence), children (array, even if empty).

14. ROOT REQUIREMENT
The root title should be the ROLE itself: "${careerGoal}".
The root summary should briefly describe the complete path to mastering the role.

15. IMPORTANT FINAL INSTRUCTION
Do not generate a shallow tree. Do not generate a beautiful outline. Generate a deeply decomposed technical knowledge tree with concept-level detail.

Now produce the complete JSON tree for ROLE = ${careerGoal}.`;
}

/** Returns a deeply technical mock tree for local development (no API key needed). */
function getMockTree(careerGoal: string): GeneratedTreePayload {
  const goal = careerGoal.trim();
  return {
    name: `${goal} Roadmap`,
    description: `A deeply technical, domain-driven learning path to become a job-ready ${goal}.`,
    icon: '💻',
    tree: {
      title: goal,
      summary: `Complete knowledge tree covering every technical domain a professional ${goal} must master.`,
      children: [
        {
          title: 'Internet & Web Fundamentals',
          summary: 'How the web works from DNS to rendering.',
          children: [
            {
              title: 'DNS Resolution',
              summary: 'Translating domain names to IP addresses.',
              children: [
                { title: 'DNS Record Types', summary: 'A, AAAA, CNAME, MX, TXT, NS records and their purposes.', children: [] },
                { title: 'DNS Propagation', summary: 'How DNS changes spread across global nameservers.', children: [] },
                { title: 'DNS Caching', summary: 'Browser, OS, and resolver-level DNS caches.', children: [] },
              ],
            },
            {
              title: 'HTTP Protocol',
              summary: 'The request/response protocol powering the web.',
              children: [
                { title: 'HTTP Methods', summary: 'GET, POST, PUT, PATCH, DELETE and their semantics.', children: [] },
                { title: 'Status Codes', summary: '2xx, 3xx, 4xx, 5xx categories and common codes.', children: [] },
                { title: 'Headers', summary: 'Content-Type, Authorization, Cache-Control, CORS headers.', children: [] },
                { title: 'HTTP/2 & HTTP/3', summary: 'Multiplexing, server push, and QUIC protocol.', children: [] },
              ],
            },
            {
              title: 'HTTPS & TLS',
              summary: 'Encrypting web traffic end-to-end.',
              children: [
                { title: 'TLS Handshake', summary: 'Certificate exchange, key negotiation, and cipher suites.', children: [] },
                { title: 'SSL Certificates', summary: 'Certificate authorities, Let\'s Encrypt, and renewal.', children: [] },
              ],
            },
            {
              title: 'Browser Internals',
              summary: 'How browsers parse, render, and execute web pages.',
              children: [
                { title: 'Parsing HTML to DOM', summary: 'Tokenizer, tree construction, and error recovery.', children: [] },
                { title: 'CSSOM Construction', summary: 'Parsing stylesheets into the CSS object model.', children: [] },
                { title: 'Render Tree & Layout', summary: 'Combining DOM and CSSOM, computing geometry.', children: [] },
                { title: 'Paint & Compositing', summary: 'Rasterising layers and GPU compositing.', children: [] },
                { title: 'Critical Rendering Path', summary: 'Optimising the sequence from request to first paint.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'HTML',
          summary: 'Semantic document structure for the web.',
          children: [
            {
              title: 'Semantic Elements',
              summary: 'Using elements that convey meaning.',
              children: [
                { title: 'header, nav, main, footer', summary: 'Page-level landmark elements.', children: [] },
                { title: 'article, section, aside', summary: 'Content grouping semantics.', children: [] },
                { title: 'figure, figcaption, details', summary: 'Media and disclosure elements.', children: [] },
              ],
            },
            {
              title: 'Forms & Validation',
              summary: 'Collecting user input and validating it.',
              children: [
                { title: 'Input Types', summary: 'text, email, number, date, file, range, and custom inputs.', children: [] },
                { title: 'Built-in Validation', summary: 'required, pattern, min/max, and custom validity API.', children: [] },
                { title: 'Form Submission', summary: 'Action, method, FormData, and fetch-based submission.', children: [] },
              ],
            },
            {
              title: 'Accessibility (a11y)',
              summary: 'Making HTML usable by everyone.',
              children: [
                { title: 'ARIA Roles & Attributes', summary: 'role, aria-label, aria-live, aria-expanded.', children: [] },
                { title: 'Keyboard Navigation', summary: 'Tab order, focus management, and skip links.', children: [] },
                { title: 'Screen Reader Testing', summary: 'Testing with VoiceOver, NVDA, and Lighthouse.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'CSS',
          summary: 'Styling, layout, and visual design for the web.',
          children: [
            {
              title: 'Selectors & Specificity',
              summary: 'Targeting elements and resolving conflicts.',
              children: [
                { title: 'Selector Types', summary: 'Element, class, ID, attribute, pseudo-class, pseudo-element.', children: [] },
                { title: 'Specificity Calculation', summary: 'How browsers resolve conflicting rules.', children: [] },
                { title: 'Cascade & Inheritance', summary: 'Rule origin order, !important, and inherited properties.', children: [] },
              ],
            },
            {
              title: 'Box Model',
              summary: 'Content, padding, border, and margin.',
              children: [
                { title: 'box-sizing', summary: 'content-box vs border-box behaviour.', children: [] },
                { title: 'Margin Collapse', summary: 'When and why adjacent margins merge.', children: [] },
              ],
            },
            {
              title: 'Flexbox',
              summary: 'One-dimensional layout along a single axis.',
              children: [
                { title: 'flex-direction & wrap', summary: 'Row, column, and wrapping behaviour.', children: [] },
                { title: 'justify-content & align-items', summary: 'Main-axis and cross-axis alignment.', children: [] },
                { title: 'flex-grow, flex-shrink, flex-basis', summary: 'How items expand and contract.', children: [] },
              ],
            },
            {
              title: 'CSS Grid',
              summary: 'Two-dimensional layout with rows and columns.',
              children: [
                { title: 'grid-template-columns/rows', summary: 'Defining explicit track sizes.', children: [] },
                { title: 'Grid Areas & Named Lines', summary: 'Placing items with grid-area and line names.', children: [] },
                { title: 'Auto-fill vs Auto-fit', summary: 'Responsive grids without media queries.', children: [] },
                { title: 'Subgrid', summary: 'Inheriting parent grid tracks in nested grids.', children: [] },
              ],
            },
            {
              title: 'Responsive Design',
              summary: 'Adapting layouts to different screen sizes.',
              children: [
                { title: 'Media Queries', summary: 'Breakpoints, min-width vs max-width strategies.', children: [] },
                { title: 'Container Queries', summary: 'Styling based on parent size instead of viewport.', children: [] },
                { title: 'Fluid Typography', summary: 'clamp(), viewport units, and fluid scaling.', children: [] },
              ],
            },
            {
              title: 'Animations & Transitions',
              summary: 'Motion and visual feedback.',
              children: [
                { title: 'CSS Transitions', summary: 'Transitioning properties on state change.', children: [] },
                { title: '@keyframes Animations', summary: 'Defining multi-step animation sequences.', children: [] },
                { title: 'transform & will-change', summary: 'GPU-accelerated transforms and compositing hints.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'JavaScript',
          summary: 'The programming language of the web.',
          children: [
            {
              title: 'Variables & Scope',
              summary: 'Declaring and scoping values.',
              children: [
                { title: 'var vs let vs const', summary: 'Declaration keywords and their scoping rules.', children: [] },
                { title: 'Block Scope vs Function Scope', summary: 'Where variables are visible.', children: [] },
                { title: 'Hoisting', summary: 'How declarations are moved to the top of their scope.', children: [] },
                { title: 'Temporal Dead Zone', summary: 'The gap before a let/const declaration is initialised.', children: [] },
              ],
            },
            {
              title: 'Data Types & Coercion',
              summary: 'Primitives, objects, and implicit type conversion.',
              children: [
                { title: 'Primitive Types', summary: 'string, number, bigint, boolean, null, undefined, symbol.', children: [] },
                { title: 'Type Coercion Rules', summary: 'How == triggers implicit conversion.', children: [] },
                { title: 'Truthy & Falsy Values', summary: 'Which values coerce to true or false.', children: [] },
                { title: 'Reference vs Value', summary: 'Pass-by-value for primitives, pass-by-reference for objects.', children: [] },
              ],
            },
            {
              title: 'Functions',
              summary: 'First-class functions and their behaviour.',
              children: [
                { title: 'Declaration vs Expression', summary: 'Hoisted declarations vs assigned expressions.', children: [] },
                { title: 'Arrow Functions', summary: 'Concise syntax and lexical this binding.', children: [] },
                { title: 'Closures', summary: 'Functions that capture their surrounding scope.', children: [] },
                { title: 'Default & Rest Parameters', summary: 'Default values and collecting remaining arguments.', children: [] },
                { title: 'Higher-order Functions', summary: 'Functions that accept or return other functions.', children: [] },
              ],
            },
            {
              title: 'this Keyword',
              summary: 'How this is determined at call time.',
              children: [
                { title: 'Global & Function Context', summary: 'Default this in strict and non-strict mode.', children: [] },
                { title: 'Implicit Binding', summary: 'this set by the object calling the method.', children: [] },
                { title: 'Explicit Binding', summary: 'call(), apply(), and bind() for manual this assignment.', children: [] },
                { title: 'Arrow Function this', summary: 'Lexical this inherited from the enclosing scope.', children: [] },
              ],
            },
            {
              title: 'Prototypes & Inheritance',
              summary: 'JavaScript\'s prototype chain model.',
              children: [
                { title: 'Prototype Chain', summary: 'How property lookup traverses the __proto__ chain.', children: [] },
                { title: 'Constructor Functions', summary: 'Creating objects with new and setting prototypes.', children: [] },
                { title: 'ES6 Classes', summary: 'class syntax, extends, super, and static members.', children: [] },
                { title: 'Object.create()', summary: 'Creating objects with an explicit prototype.', children: [] },
              ],
            },
            {
              title: 'Async Programming',
              summary: 'Non-blocking execution and concurrency.',
              children: [
                {
                  title: 'Event Loop',
                  summary: 'The runtime model for async execution.',
                  children: [
                    { title: 'Call Stack', summary: 'LIFO stack of currently executing frames.', children: [] },
                    { title: 'Microtask Queue', summary: 'Promise callbacks processed after each task.', children: [] },
                    { title: 'Macrotask Queue', summary: 'setTimeout, setInterval, and I/O callbacks.', children: [] },
                  ],
                },
                {
                  title: 'Promises',
                  summary: 'Representing eventual values.',
                  children: [
                    { title: '.then/.catch/.finally', summary: 'Chaining handlers on resolved or rejected promises.', children: [] },
                    { title: 'Promise.all / Promise.race', summary: 'Composing multiple promises in parallel.', children: [] },
                    { title: 'Promise.allSettled', summary: 'Waiting for all promises regardless of outcome.', children: [] },
                  ],
                },
                {
                  title: 'async/await',
                  summary: 'Syntactic sugar for promise-based flows.',
                  children: [
                    { title: 'try/catch in async', summary: 'Error handling inside async functions.', children: [] },
                    { title: 'Sequential vs Parallel await', summary: 'Avoiding waterfall awaits with Promise.all.', children: [] },
                  ],
                },
              ],
            },
            {
              title: 'ES6+ Features',
              summary: 'Modern JavaScript additions.',
              children: [
                { title: 'Destructuring', summary: 'Extracting values from arrays and objects.', children: [] },
                { title: 'Spread & Rest Operators', summary: 'Copying, merging, and collecting elements.', children: [] },
                { title: 'Template Literals', summary: 'String interpolation and tagged templates.', children: [] },
                { title: 'Modules (import/export)', summary: 'ES module syntax and tree-shaking.', children: [] },
                { title: 'Optional Chaining & Nullish Coalescing', summary: '?. and ?? operators for safe access.', children: [] },
                { title: 'Map, Set, WeakMap, WeakSet', summary: 'Keyed and unique-value collections.', children: [] },
                { title: 'Iterators & Generators', summary: 'Custom iteration and lazy evaluation with yield.', children: [] },
              ],
            },
            {
              title: 'DOM Manipulation',
              summary: 'Querying and modifying the document.',
              children: [
                { title: 'querySelector & querySelectorAll', summary: 'CSS-selector-based element lookup.', children: [] },
                { title: 'Creating & Removing Elements', summary: 'createElement, appendChild, remove.', children: [] },
                { title: 'Event Handling', summary: 'addEventListener, event object, and delegation.', children: [] },
                { title: 'Event Bubbling & Capturing', summary: 'Propagation phases and stopPropagation.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'TypeScript',
          summary: 'Static typing for JavaScript applications.',
          children: [
            {
              title: 'Type System',
              summary: 'Core type annotations and inference.',
              children: [
                { title: 'Primitive & Object Types', summary: 'string, number, boolean, arrays, tuples, enums.', children: [] },
                { title: 'Type Inference', summary: 'How TypeScript infers types without annotations.', children: [] },
                { title: 'Union & Intersection Types', summary: 'Combining types with | and &.', children: [] },
                { title: 'Literal Types & const Assertions', summary: 'Narrowing types to specific values.', children: [] },
              ],
            },
            {
              title: 'Interfaces & Type Aliases',
              summary: 'Defining named shapes and contracts.',
              children: [
                { title: 'interface vs type', summary: 'When to use each and their differences.', children: [] },
                { title: 'Extending & Merging', summary: 'Interface extension and declaration merging.', children: [] },
                { title: 'Index Signatures', summary: 'Typing objects with dynamic keys.', children: [] },
              ],
            },
            {
              title: 'Generics',
              summary: 'Reusable typed abstractions.',
              children: [
                { title: 'Generic Functions', summary: 'Parameterising function signatures with type variables.', children: [] },
                { title: 'Generic Constraints', summary: 'Restricting type parameters with extends.', children: [] },
                { title: 'Utility Types', summary: 'Partial, Required, Pick, Omit, Record, ReturnType.', children: [] },
              ],
            },
            {
              title: 'Type Narrowing',
              summary: 'Refining types at runtime.',
              children: [
                { title: 'typeof & instanceof Guards', summary: 'Narrowing with runtime checks.', children: [] },
                { title: 'Discriminated Unions', summary: 'Using a common literal field to narrow union types.', children: [] },
                { title: 'Custom Type Predicates', summary: 'User-defined type guard functions.', children: [] },
              ],
            },
            {
              title: 'tsconfig & Strict Mode',
              summary: 'Compiler configuration and strictness flags.',
              children: [
                { title: 'strict, noUnusedLocals, noImplicitAny', summary: 'Key strictness flags and their effects.', children: [] },
                { title: 'Module Resolution', summary: 'Node vs Bundler resolution strategies.', children: [] },
                { title: 'Path Aliases', summary: 'Mapping import paths to directories.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'React',
          summary: 'Component-based UI library for building interactive interfaces.',
          children: [
            {
              title: 'Components & JSX',
              summary: 'Building blocks of a React application.',
              children: [
                { title: 'Functional Components', summary: 'Declaring components as plain functions.', children: [] },
                { title: 'JSX Syntax & Expressions', summary: 'Embedding expressions and conditional rendering.', children: [] },
                { title: 'Props & Children', summary: 'Passing data and nested content to components.', children: [] },
                { title: 'Component Composition', summary: 'Building complex UIs from small reusable pieces.', children: [] },
              ],
            },
            {
              title: 'Hooks',
              summary: 'Managing state and side effects in function components.',
              children: [
                { title: 'useState', summary: 'Local component state and updater functions.', children: [] },
                { title: 'useEffect', summary: 'Side effects, cleanup, and dependency arrays.', children: [] },
                { title: 'useRef', summary: 'Mutable references and DOM access.', children: [] },
                { title: 'useMemo & useCallback', summary: 'Memoising values and callback identity.', children: [] },
                { title: 'useContext', summary: 'Consuming React context without a wrapper.', children: [] },
                { title: 'useReducer', summary: 'Complex state logic with a reducer pattern.', children: [] },
                { title: 'Custom Hooks', summary: 'Extracting reusable stateful logic.', children: [] },
              ],
            },
            {
              title: 'Rendering & Reconciliation',
              summary: 'How React updates the DOM efficiently.',
              children: [
                { title: 'Virtual DOM', summary: 'In-memory representation diffed against the real DOM.', children: [] },
                { title: 'Reconciliation Algorithm', summary: 'Key-based diffing and minimal DOM updates.', children: [] },
                { title: 'React.memo & PureComponent', summary: 'Skipping unnecessary re-renders.', children: [] },
                { title: 'Key Prop & List Rendering', summary: 'Stable keys for efficient list diffing.', children: [] },
              ],
            },
            {
              title: 'Routing',
              summary: 'Client-side navigation and URL management.',
              children: [
                { title: 'React Router Setup', summary: 'BrowserRouter, Routes, Route, and Link.', children: [] },
                { title: 'Dynamic Routes & Params', summary: 'useParams for path parameters.', children: [] },
                { title: 'Nested Routes & Outlet', summary: 'Layout routes and child rendering.', children: [] },
                { title: 'Programmatic Navigation', summary: 'useNavigate for code-driven route changes.', children: [] },
              ],
            },
            {
              title: 'Forms in React',
              summary: 'Handling user input in React components.',
              children: [
                { title: 'Controlled Components', summary: 'State-driven input values with onChange.', children: [] },
                { title: 'Uncontrolled Components & useRef', summary: 'Direct DOM access for form values.', children: [] },
                { title: 'Form Validation Patterns', summary: 'Inline validation, Zod/Yup schema validation.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'State Management',
          summary: 'Managing application state beyond local component scope.',
          children: [
            {
              title: 'React Context API',
              summary: 'Built-in provider/consumer pattern for shared state.',
              children: [
                { title: 'createContext & Provider', summary: 'Creating and providing context values.', children: [] },
                { title: 'Context Performance Pitfalls', summary: 'Avoiding unnecessary re-renders from context changes.', children: [] },
              ],
            },
            {
              title: 'Zustand / Jotai / Redux',
              summary: 'External state management libraries.',
              children: [
                { title: 'Store Creation', summary: 'Defining a global store with actions and selectors.', children: [] },
                { title: 'Selectors & Derived State', summary: 'Computing values from store state efficiently.', children: [] },
                { title: 'Async Actions', summary: 'Handling side effects in state updates.', children: [] },
              ],
            },
            {
              title: 'Server State (React Query / SWR)',
              summary: 'Caching and synchronising remote data.',
              children: [
                { title: 'Query Keys & Caching', summary: 'Cache invalidation and key-based identity.', children: [] },
                { title: 'Mutations & Optimistic Updates', summary: 'Writing data and updating the UI optimistically.', children: [] },
                { title: 'Stale-While-Revalidate', summary: 'Serving cached data while fetching fresh data.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Backend Development (Node.js)',
          summary: 'Server-side JavaScript with Node.js.',
          children: [
            {
              title: 'Node.js Runtime',
              summary: 'Server-side JS execution environment.',
              children: [
                { title: 'Event Loop (Node)', summary: 'libuv, I/O phases, and non-blocking architecture.', children: [] },
                { title: 'Modules (CommonJS & ESM)', summary: 'require vs import in Node.js.', children: [] },
                { title: 'File System API (fs)', summary: 'Reading, writing, and watching files.', children: [] },
                { title: 'Streams & Buffers', summary: 'Efficient processing of large data with streams.', children: [] },
                { title: 'Environment Variables', summary: 'process.env, .env files, and dotenv.', children: [] },
              ],
            },
            {
              title: 'Express.js',
              summary: 'Minimal web framework for Node.',
              children: [
                { title: 'Routing', summary: 'Route handlers with app.get/post/put/delete.', children: [] },
                { title: 'Middleware', summary: 'Request pipeline, next(), and middleware ordering.', children: [] },
                { title: 'Error Handling Middleware', summary: 'Centralised error handler with 4-argument function.', children: [] },
                { title: 'Request Parsing', summary: 'Body parsing (JSON, URL-encoded), query params, path params.', children: [] },
              ],
            },
            {
              title: 'Serverless Functions',
              summary: 'Running backend code without managing servers.',
              children: [
                { title: 'Vercel / Netlify Functions', summary: 'File-based serverless routing.', children: [] },
                { title: 'AWS Lambda', summary: 'Event-driven functions with cold-start considerations.', children: [] },
                { title: 'Edge Functions', summary: 'Running code at CDN edge for low latency.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'REST APIs',
          summary: 'Designing and consuming RESTful services.',
          children: [
            {
              title: 'REST Principles',
              summary: 'Architecture constraints for web APIs.',
              children: [
                { title: 'Resource Naming', summary: 'Nouns, plural paths, and hierarchical URIs.', children: [] },
                { title: 'HTTP Verb Semantics', summary: 'Mapping CRUD operations to GET/POST/PUT/PATCH/DELETE.', children: [] },
                { title: 'Status Code Conventions', summary: '200, 201, 204, 400, 401, 403, 404, 409, 500.', children: [] },
              ],
            },
            {
              title: 'Request & Response Design',
              summary: 'Structuring data flowing in and out.',
              children: [
                { title: 'JSON Payloads', summary: 'Request bodies, response shapes, and envelope patterns.', children: [] },
                { title: 'Pagination', summary: 'Offset, cursor-based, and keyset pagination.', children: [] },
                { title: 'Filtering & Sorting', summary: 'Query parameter patterns for listing endpoints.', children: [] },
                { title: 'Error Response Format', summary: 'Consistent error objects with code, message, and details.', children: [] },
              ],
            },
            {
              title: 'API Versioning',
              summary: 'Managing breaking changes over time.',
              children: [
                { title: 'URL Path Versioning', summary: '/api/v1/ vs /api/v2/ approach.', children: [] },
                { title: 'Header-based Versioning', summary: 'Accept header version negotiation.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Authentication & Authorization',
          summary: 'Identity verification and access control.',
          children: [
            {
              title: 'Authentication Methods',
              summary: 'Verifying who the user is.',
              children: [
                { title: 'Session-based Auth', summary: 'Server-side sessions with cookies.', children: [] },
                { title: 'Token-based Auth (JWT)', summary: 'Stateless tokens with header, payload, and signature.', children: [] },
                { title: 'OAuth 2.0 Flow', summary: 'Authorization code, implicit, and PKCE flows.', children: [] },
                { title: 'Social Login (Google, GitHub)', summary: 'Delegated authentication with third-party providers.', children: [] },
              ],
            },
            {
              title: 'JWT Deep Dive',
              summary: 'Structure and security of JSON Web Tokens.',
              children: [
                { title: 'Token Structure', summary: 'Header, payload, signature, and base64url encoding.', children: [] },
                { title: 'Access vs Refresh Tokens', summary: 'Short-lived access tokens and long-lived refresh tokens.', children: [] },
                { title: 'Token Storage', summary: 'httpOnly cookies vs localStorage and XSS/CSRF trade-offs.', children: [] },
                { title: 'Token Rotation', summary: 'Rotating refresh tokens for revocation safety.', children: [] },
              ],
            },
            {
              title: 'Authorization',
              summary: 'Controlling what authenticated users can do.',
              children: [
                { title: 'Role-based Access Control (RBAC)', summary: 'Assigning permissions via roles.', children: [] },
                { title: 'Row-level Security (RLS)', summary: 'Database-enforced per-row access policies.', children: [] },
                { title: 'Middleware Guards', summary: 'Protecting routes with auth checks in the request pipeline.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Databases',
          summary: 'Storing, querying, and managing persistent data.',
          children: [
            {
              title: 'SQL (PostgreSQL)',
              summary: 'Relational database fundamentals.',
              children: [
                {
                  title: 'Schema Design',
                  summary: 'Tables, columns, types, and relationships.',
                  children: [
                    { title: 'Primary & Foreign Keys', summary: 'Identity and referential integrity constraints.', children: [] },
                    { title: 'Normalization (1NF–3NF)', summary: 'Eliminating redundancy through normal forms.', children: [] },
                    { title: 'Data Types', summary: 'text, int, uuid, timestamptz, jsonb, arrays.', children: [] },
                  ],
                },
                {
                  title: 'Queries',
                  summary: 'Retrieving and manipulating data.',
                  children: [
                    { title: 'SELECT, WHERE, ORDER BY', summary: 'Filtering and sorting result sets.', children: [] },
                    { title: 'JOINs (INNER, LEFT, FULL)', summary: 'Combining rows from related tables.', children: [] },
                    { title: 'GROUP BY & Aggregates', summary: 'COUNT, SUM, AVG, and grouping.', children: [] },
                    { title: 'Subqueries & CTEs', summary: 'WITH clauses and nested queries.', children: [] },
                  ],
                },
                {
                  title: 'Indexes & Performance',
                  summary: 'Speeding up queries.',
                  children: [
                    { title: 'B-tree Indexes', summary: 'Default index type for equality and range queries.', children: [] },
                    { title: 'Composite Indexes', summary: 'Multi-column indexes and column order.', children: [] },
                    { title: 'EXPLAIN ANALYZE', summary: 'Reading query plans and identifying bottlenecks.', children: [] },
                  ],
                },
                {
                  title: 'Migrations',
                  summary: 'Versioning database schema changes.',
                  children: [
                    { title: 'Migration Files', summary: 'Ordered SQL scripts for schema evolution.', children: [] },
                    { title: 'Rollbacks', summary: 'Reverting schema changes safely.', children: [] },
                  ],
                },
              ],
            },
            {
              title: 'Supabase / Firebase',
              summary: 'Backend-as-a-service platforms.',
              children: [
                { title: 'Supabase Client', summary: 'Connecting, querying, and subscribing to changes.', children: [] },
                { title: 'Supabase Auth', summary: 'User registration, login, and session management.', children: [] },
                { title: 'RLS Policies', summary: 'Writing row-level security policies for tables.', children: [] },
                { title: 'Realtime Subscriptions', summary: 'Listening to database changes over WebSocket.', children: [] },
              ],
            },
            {
              title: 'Caching',
              summary: 'Reducing database load with fast caches.',
              children: [
                { title: 'Redis', summary: 'In-memory key-value store for caching and sessions.', children: [] },
                { title: 'Cache Invalidation Strategies', summary: 'TTL, write-through, and cache-aside patterns.', children: [] },
                { title: 'HTTP Caching', summary: 'Cache-Control, ETag, and CDN caching.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Git & Version Control',
          summary: 'Tracking changes and collaborating on code.',
          children: [
            {
              title: 'Git Fundamentals',
              summary: 'Core operations and mental model.',
              children: [
                { title: 'Working Directory, Staging, Commits', summary: 'The three-stage workflow.', children: [] },
                { title: 'Branching & Merging', summary: 'Creating branches and merging changes.', children: [] },
                { title: 'Rebasing', summary: 'Replaying commits onto a new base for linear history.', children: [] },
                { title: 'Resolving Merge Conflicts', summary: 'Understanding and fixing conflicting changes.', children: [] },
              ],
            },
            {
              title: 'GitHub Workflows',
              summary: 'Collaboration patterns on GitHub.',
              children: [
                { title: 'Pull Requests', summary: 'Code review, discussion, and merge workflows.', children: [] },
                { title: 'Branch Protection Rules', summary: 'Required reviews, status checks, and merge restrictions.', children: [] },
                { title: 'GitHub Actions', summary: 'CI/CD automation triggered by repository events.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Testing',
          summary: 'Verifying code correctness at every level.',
          children: [
            {
              title: 'Unit Testing',
              summary: 'Testing individual functions and modules.',
              children: [
                { title: 'Vitest / Jest Setup', summary: 'Configuring a test runner and assertions.', children: [] },
                { title: 'Writing Assertions', summary: 'expect(), toBe(), toEqual(), toThrow().', children: [] },
                { title: 'Mocking & Spying', summary: 'Replacing dependencies with controlled fakes.', children: [] },
                { title: 'Testing Async Code', summary: 'Handling promises and timers in tests.', children: [] },
              ],
            },
            {
              title: 'Component Testing',
              summary: 'Testing React components in isolation.',
              children: [
                { title: 'React Testing Library', summary: 'Rendering, querying, and asserting on components.', children: [] },
                { title: 'User Event Simulation', summary: 'Simulating clicks, typing, and keyboard events.', children: [] },
                { title: 'Snapshot Testing', summary: 'Capturing and comparing rendered output.', children: [] },
              ],
            },
            {
              title: 'End-to-End Testing',
              summary: 'Testing full user flows in a browser.',
              children: [
                { title: 'Playwright / Cypress', summary: 'Automating browser interactions and assertions.', children: [] },
                { title: 'Page Object Pattern', summary: 'Abstracting selectors and actions into reusable objects.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Deployment & DevOps',
          summary: 'Shipping and operating applications in production.',
          children: [
            {
              title: 'CI/CD',
              summary: 'Automating build, test, and deploy pipelines.',
              children: [
                { title: 'GitHub Actions Workflows', summary: 'YAML-based CI/CD triggered on push and PR events.', children: [] },
                { title: 'Pipeline Stages', summary: 'Lint → Test → Build → Deploy stages.', children: [] },
                { title: 'Environment Variables in CI', summary: 'Secrets management in deployment pipelines.', children: [] },
              ],
            },
            {
              title: 'Hosting & Platforms',
              summary: 'Where and how to deploy applications.',
              children: [
                { title: 'Vercel', summary: 'Git-connected deploys, serverless functions, and edge network.', children: [] },
                { title: 'Netlify', summary: 'Static site hosting with form and function support.', children: [] },
                { title: 'AWS (EC2, S3, CloudFront)', summary: 'Virtual servers, object storage, and CDN.', children: [] },
                { title: 'Docker', summary: 'Containerising applications for consistent environments.', children: [
                  { title: 'Dockerfile', summary: 'Writing multi-stage build instructions.', children: [] },
                  { title: 'Docker Compose', summary: 'Defining multi-container development stacks.', children: [] },
                  { title: 'Image Layers & Caching', summary: 'Optimising build speed and image size.', children: [] },
                ] },
              ],
            },
            {
              title: 'Monitoring & Logging',
              summary: 'Observing production systems.',
              children: [
                { title: 'Structured Logging', summary: 'JSON logs with context for searchability.', children: [] },
                { title: 'Error Tracking (Sentry)', summary: 'Capturing and triaging runtime exceptions.', children: [] },
                { title: 'Uptime Monitoring', summary: 'Health checks and alerting on downtime.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Security',
          summary: 'Protecting applications and user data.',
          children: [
            {
              title: 'Common Vulnerabilities',
              summary: 'OWASP Top 10 threats for web applications.',
              children: [
                { title: 'XSS (Cross-Site Scripting)', summary: 'Injecting scripts via user input; prevention with escaping and CSP.', children: [] },
                { title: 'CSRF (Cross-Site Request Forgery)', summary: 'Forging requests on behalf of authenticated users; token-based prevention.', children: [] },
                { title: 'SQL Injection', summary: 'Injecting malicious SQL; prevention with parameterised queries.', children: [] },
                { title: 'Broken Access Control', summary: 'Exposing unauthorised data through missing server-side checks.', children: [] },
              ],
            },
            {
              title: 'Secure Headers',
              summary: 'HTTP headers that harden security.',
              children: [
                { title: 'Content-Security-Policy', summary: 'Restricting resource origins to prevent XSS.', children: [] },
                { title: 'Strict-Transport-Security', summary: 'Forcing HTTPS connections.', children: [] },
                { title: 'X-Frame-Options', summary: 'Preventing clickjacking via framing.', children: [] },
              ],
            },
            {
              title: 'Input Validation & Sanitisation',
              summary: 'Ensuring all user input is safe.',
              children: [
                { title: 'Server-side Validation', summary: 'Validating payloads with Zod, Joi, or similar.', children: [] },
                { title: 'Output Encoding', summary: 'Escaping HTML, URL, and JS contexts before rendering.', children: [] },
              ],
            },
          ],
        },
        {
          title: 'Performance',
          summary: 'Making applications fast and responsive.',
          children: [
            {
              title: 'Frontend Performance',
              summary: 'Optimising load speed and interaction responsiveness.',
              children: [
                { title: 'Code Splitting', summary: 'Lazy-loading routes and components to reduce initial bundle.', children: [] },
                { title: 'Tree Shaking', summary: 'Removing unused exports at build time.', children: [] },
                { title: 'Image Optimisation', summary: 'WebP/AVIF, lazy loading, srcset, and CDN delivery.', children: [] },
                { title: 'Core Web Vitals', summary: 'LCP, FID/INP, and CLS metrics and how to improve them.', children: [] },
                { title: 'React Performance', summary: 'Profiler, memo, useMemo, useCallback, and avoiding re-renders.', children: [] },
              ],
            },
            {
              title: 'Backend Performance',
              summary: 'Optimising server throughput and latency.',
              children: [
                { title: 'Database Query Optimisation', summary: 'Indexes, EXPLAIN plans, and N+1 query elimination.', children: [] },
                { title: 'Connection Pooling', summary: 'Reusing database connections to avoid overhead.', children: [] },
                { title: 'Response Compression', summary: 'gzip/brotli for reducing payload sizes.', children: [] },
                { title: 'Rate Limiting', summary: 'Protecting APIs from abuse and traffic spikes.', children: [] },
              ],
            },
          ],
        },
      ],
    },
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requireAuth } = await import('./lib/requireAuth.js');
  const userId = await requireAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  let body: { careerGoal?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { careerGoal } = body;
  if (!careerGoal?.trim()) {
    return res.status(400).json({ error: 'careerGoal is required' });
  }

  // Development / no-key mode: return a structured mock so the UI works without OpenAI.
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json(getMockTree(careerGoal));
  }

  try {
    const result = await generateTreeStaged(careerGoal);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI tree generation failed';
    console.error('[generate-tree]', message);
    return res.status(502).json({ error: message });
  }
}
