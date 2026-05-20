import { createClient } from "npm:@supabase/supabase-js@2";

const PRS_URL =
  "https://podatki.gov.si/dataset/9ee1a9aa-c224-4995-b2ad-3760d7af0748/resource/beb70929-3d0d-41c6-9af2-25d525d906d3/download/opsiprs.csv";

const DEFAULT_LIMIT = 10000;
const MAX_LIMIT = 20000;
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  try {
    const body = req.method === "POST" ? await safeJson(req) : {};

    const offset = Math.max(0, Number(body.offset || 0));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(body.limit || DEFAULT_LIMIT))
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const res = await fetch(PRS_URL);

    if (!res.ok || !res.body) {
      return json({
        ok: false,
        error: "PRS download failed",
        status: res.status,
        statusText: res.statusText
      }, 500);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-16le");

    let buffer = "";
    let headers: string[] = [];

    let seen = 0;
    let imported = 0;
    let skipped = 0;
    let batches = 0;
    let batch: Record<string, unknown>[] = [];

    const targetEnd = offset + limit;

    while (seen < targetEnd) {
      const { value, done } = await reader.read();

      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        if (headers.length === 0) {
          headers = parseCsvLine(line);
          continue;
        }

        if (seen >= targetEnd) break;

        if (seen < offset) {
          seen++;
          continue;
        }

        const cols = parseCsvLine(line);
        const record = mapPrsRow(headers, cols);

        seen++;

        if (!record.registration_number || !record.company_name) {
          skipped++;
          continue;
        }

        batch.push(record);
        imported++;

        if (batch.length >= BATCH_SIZE) {
          const result = await flushBatch(supabase, batch);

          if (result.error) {
            return json({
              ok: false,
              error: result.error,
              offset,
              limit,
              seen,
              imported,
              skipped,
              batches,
              failedBatchSize: batch.length
            }, 500);
          }

          batches++;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      const result = await flushBatch(supabase, batch);

      if (result.error) {
        return json({
          ok: false,
          error: result.error,
          offset,
          limit,
          seen,
          imported,
          skipped,
          batches,
          failedBatchSize: batch.length
        }, 500);
      }

      batches++;
    }

    return json({
      ok: true,
      status: "import_completed",
      offset,
      limit,
      seen,
      imported,
      skipped,
      batches,
      batchSize: BATCH_SIZE,
      nextOffset: offset + imported,
      headers
    });

  } catch (err) {
    return json({
      ok: false,
      error: String(err)
    }, 500);
  }
});

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function flushBatch(
  supabase: ReturnType<typeof createClient>,
  batch: Record<string, unknown>[]
) {
  const { error } = await supabase
    .from("prs_cache")
    .upsert(batch, {
      onConflict: "registration_number"
    });

  return {
    error: error ? error.message : null
  };
}

function mapPrsRow(headers: string[], cols: string[]) {
  const row: Record<string, string> = {};

  headers.forEach((h, i) => {
    row[h.trim()] = cols[i]?.trim() || "";
  });

  const street = row["Ulica"] || "";
  const houseNo = row["Hišna št"] || row["Hišna št "] || "";
  const houseAdd =
    row["Hišna št dodatek"] ||
    row["Hišna št  dodatek"] ||
    "";

  const postCode = row["Poštna št"] || row["Poštna št "] || "";
  const post = row["Pošta"] || "";

  const address = [
    [street, houseNo, houseAdd].filter(Boolean).join(" "),
    [postCode, post].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");

  return {
    registration_number: row["Matična številka"],
    company_name: row["Popolno ime"],
    tax_number: null,
    legal_form: row["Pravnoorganizacijska oblika"],
    address,
    municipality: post,
    region: null,
    main_activity_code: null,
    main_activity_name: null,
    source: "opsi-prs",
    raw_payload: row,
    updated_at: new Date().toISOString()
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}