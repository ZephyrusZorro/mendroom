# Mendroom

**A little care. A longer life.** A free, local-first workbench for community repair events.

Mendroom helps a coordinator check in an item, find a compatible volunteer, manage a fair queue, and leave the visitor with a useful repair record. It runs on your computer and stores its SQLite database locally. No cloud account, API key, or AI subscription.

## Run

Install Node.js **24 LTS**, then:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4317**. Development: `npm run dev`. Checks: `npm run check`.

Implementation is in progress. Each milestone is pushed as it is built; verification and screenshots will be added before release.

## Project decisions

- [Product and architecture](docs/product.md)
- [Research and opportunity selection](docs/research.md)
- [Implementation plan](docs/plan.md)

## Scope

One trusted coordinator on a local machine. No public hosting or remote authentication is implied. Real visitor records stay in the ignored `data/` folder. Sample content is explicitly marked and never automatically inserted into a real session.

## License

MIT.
