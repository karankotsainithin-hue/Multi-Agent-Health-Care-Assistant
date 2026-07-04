# Multi-Agent Health Assistant — Combined Site

This connects your **Lovable-style patient form** to your **deployed CrewAI crew**
through a small backend, so the token stays private and the form gets real results.

```
Browser (index.html form)
      │  POST /api/assess  { name, age, gender, symptoms, insurance }
      ▼
Your backend (server.js)     <-- holds the Bearer Token, never exposed
      │  POST {CREWAI_URL}/kickoff
      │  GET  {CREWAI_URL}/status/{kickoff_id}  (polled)
      ▼
Your CrewAI crew (already deployed and working)
```

## 1. Fill in your real values

Copy `.env.example` to `.env` and paste in the two values from your Automation's
detail page (the "Crew is online" screen):

```
CREWAI_URL=https://your-crew-name.crewai.com
CREWAI_TOKEN=<Bearer Token or User Bearer Token>
```

Use the plain **Bearer Token** for a simple single-tenant site. Use the
**User Bearer Token** flow instead if you want per-user scoping / connected
integrations tied to individual logged-in users.

## 2. Confirm your crew's exact input field names

Your tasks reference `{symptoms}`, `{age}`, `{gender}` etc. in Crew Studio — but the
*exact* key names matter for the API call. After filling in `.env`, run the server and
visit:

```
GET http://localhost:3000/api/inputs
```

This calls CrewAI's `/inputs` endpoint and lists exactly what your crew expects.
If the names differ from `name/age/gender/symptoms/insurance`, update the `inputs`
object inside `server.js` (`app.post('/api/assess', ...)`) to match.

## 3. Run it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## 4. Deploy it

Any Node host works (Render, Railway, Fly.io, a small VPS). The key rule:
**set `CREWAI_URL` and `CREWAI_TOKEN` as environment variables on the host**,
not in the code — never commit `.env`.

If you'd rather keep using your existing Lovable-hosted frontend instead of
`public/index.html`: deploy just `server.js` somewhere (it doesn't need the
`public` folder), then point your Lovable form's submit handler at that
backend's `/api/assess` URL instead of calling CrewAI directly.

## 5. Notes on the polling behavior

Your metrics show task times of 17s–105s per stage, and the full crew (per
your Run trace) takes roughly 2–3.5 minutes end-to-end. `server.js` polls every
3 seconds for up to 3 minutes before giving up — adjust `maxAttempts` in
`server.js` if your crew regularly runs longer.

For production, CrewAI's webhooks (`crewWebhookUrl` on `/kickoff`) are a better
fit than polling — the crew calls your server back when done instead of your
server repeatedly asking. Worth switching to once this is working end-to-end.
