# Refund Desk

AI-assisted refund triage for e-commerce support. A customer describes the
problem in chat; the system approves, denies or escalates the refund, and a
support dashboard shows every decision with the rules that produced it.

**The language model never decides.** It reads the customer's message into
validated fields and writes the reply. A deterministic policy engine makes the
decision from database records, not from what the message claims.

Built for the WORKNOON Full Stack Engineer assessment.

## Quick start

```bash
docker-compose up --build
```

Open <http://localhost:3000>. No API key is needed: without one, the API uses
a deterministic mock model and every demo scenario still works. To use Claude,
copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.

| Service | URL |
|---|---|
| Web app | <http://localhost:3000> |
| API | <http://localhost:4000> (docs at `/docs`) |
| Postgres | `localhost:5433` (user, password and database: `refunds`) |

Reset the demo data with `docker-compose down -v`.

## Documentation

- [Refund policy](docs/refund-policy.md), with the numbered clauses that every decision cites
- [Decisions](docs/decisions.md): what was chosen, the evidence, and what was rejected

*The full README (architecture, AI integration, security, testing, trade-offs)
arrives with the final phase.*
