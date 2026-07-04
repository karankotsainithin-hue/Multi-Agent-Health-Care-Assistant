// server.js
// Backend proxy between your patient-facing form and your deployed CrewAI crew.
// Keeps your Bearer Token secret on the server — it is NEVER sent to the browser.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves index.html

const CREW_URL = process.env.CREWAI_URL;       // e.g. https://multi-agent-healthcare-xxxx.crewai.com
const CREW_TOKEN = process.env.CREWAI_TOKEN;   // Bearer Token or User Bearer Token from the Status tab

if (!CREW_URL || !CREW_TOKEN) {
  console.warn('⚠️  CREWAI_URL / CREWAI_TOKEN are not set. Copy .env.example to .env and fill them in.');
}

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${CREW_TOKEN}`,
};

// Optional helper: lets you confirm the exact input keys your crew expects
// (Name, Age, Gender, Symptoms, Insurance — or whatever you named them in Crew Studio)
app.get('/api/inputs', async (req, res) => {
  try {
    const r = await fetch(`${CREW_URL}/inputs`, { headers: HEADERS });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kicks off the crew with the patient's form data, then polls /status
// until the run finishes (or times out), and returns the final result.
app.post('/api/assess', async (req, res) => {
  const { name, age, gender, symptoms, insurance } = req.body;

  if (!symptoms) {
    return res.status(400).json({ error: 'symptoms is required' });
  }

  // NOTE: these keys must match exactly what your crew's tasks interpolate
  // (visible in Crew Studio as {name}, {age}, {gender}, {symptoms}, {insurance}).
  // Adjust this object if GET /api/inputs shows different field names.
  const inputs = {
    name: name || 'Not provided',
    age: String(age ?? ''),
    gender: gender || 'Not provided',
    symptoms,
    insurance: insurance || 'Not provided',
  };

  try {
    const kickoffRes = await fetch(`${CREW_URL}/kickoff`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ inputs }),
    });

    if (!kickoffRes.ok) {
      const text = await kickoffRes.text();
      return res.status(kickoffRes.status).json({ error: `Kickoff failed: ${text}` });
    }

    const { kickoff_id } = await kickoffRes.json();
    if (!kickoff_id) {
      return res.status(502).json({ error: 'No kickoff_id returned by CrewAI' });
    }

    // Poll every 3s for up to 3 minutes (crew tasks in the dashboard run 15-90s each)
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));

      const statusRes = await fetch(`${CREW_URL}/status/${kickoff_id}`, { headers: HEADERS });
      const statusData = await statusRes.json();

      if (statusData.state === 'SUCCESS' || statusData.status === 'completed' || statusData.result) {
        return res.json({ status: 'completed', kickoff_id, result: statusData.result ?? statusData });
      }
      if (statusData.state === 'FAILED' || statusData.status === 'failed') {
        return res.status(500).json({ status: 'failed', kickoff_id, error: statusData });
      }
      // otherwise still running — loop again
    }

    return res.status(504).json({ error: 'Timed out waiting for crew to finish', kickoff_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
