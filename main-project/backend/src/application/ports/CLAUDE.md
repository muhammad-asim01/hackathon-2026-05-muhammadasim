# Application Ports (IPort Interfaces)

Ports define **what** infrastructure must provide. Use-cases depend only on these interfaces — never on Prisma, googleapis, or the Anthropic SDK directly.

## Repository Ports

### `ILeadRepository`
```typescript
findById(id: string): Promise<Lead | null>
findByPublicId(id: string): Promise<Lead | null>
findByGmapsPlaceId(id: string): Promise<Lead | null>
findMany(filter: LeadFilter): Promise<{ leads: Lead[]; total: number }>
create(data: CreateLeadData): Promise<Lead>
update(id: string, data: Partial<Lead>): Promise<Lead>
```

`LeadFilter` supports: `status`, `niche`, `city`, `digitalScore` (`{ lte?, gte? }`), `search`, `page`, `limit`.

### `IRunRepository`
```typescript
create(prompt: string): Promise<PipelineRun>
findById(id: string): Promise<PipelineRun | null>
findMany(options?: { limit?, offset? }): Promise<readonly PipelineRun[]>
update(id: string, data: RunUpdateData): Promise<PipelineRun>
addEvent(runId: string, event: CreateRunEventData): Promise<RunEvent>
getEvents(runId: string): Promise<readonly RunEvent[]>
getEventsByRunIds(ids: readonly string[]): Promise<Map<string, readonly RunEvent[]>>
```

`getEventsByRunIds` exists to prevent N+1 queries on the runs list endpoint.

### `IEmailRepository`
Manages email drafts. Key methods: `findByLeadId`, `create`, `approve`, `reject`.

## Service Ports

### `ILLMProvider`
```typescript
generate(systemPrompt: string, messages: ChatMessage[]): Promise<string>
```
One method — returns raw text. Prompt caching is handled in `AnthropicAdapter`.

### `IMapsService`
Returns places from OpenStreetMap/Google — used by `DiscoverBusinesses`.

### `IEmailSender`
```typescript
send(input: SendEmailInput): Promise<{ messageId: string }>
```
`SendEmailInput`: `{ to, subject, body, fromName? }`

### `IPageSpeedService`
Returns PageSpeed scores (performance, mobile) for a URL.

## Rules

- Port interfaces live in `application/ports/` — zero imports from `infrastructure/`.
- Every constructor in a use-case receives injected ports, not concrete classes.
- Adding a new external service = add a port interface here first, then the adapter in `infrastructure/external/`.
