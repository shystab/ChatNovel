# NovelCat Frontend

Next.js frontend for the NovelCat writing app.

## Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The app runs at `http://localhost:3000` and expects the backend at
`http://localhost:8000/api/v1` by default.

## Checks

```bash
npm run lint
npm run build
```

Configure API URLs in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ai/ws
```
