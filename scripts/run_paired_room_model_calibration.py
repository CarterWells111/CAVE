"""Run synthetic paired-room draft cases against the configured DeepSeek model.

Reads only the ignored apps/gateway/.dev.vars key; never prints it or HTTP bodies.
This is an offline calibration harness, not the production room API.
"""

import argparse
import datetime as dt
import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "docs" / "calibration" / "paired-room"
KEY_FILE = ROOT / "apps" / "gateway" / ".dev.vars"
MODEL = "deepseek-v4-flash"
URL = "https://api.deepseek.com/chat/completions"
MAX_TOKENS = 2000
THINKING = "disabled"


def read_key():
    values = [line.split("=", 1)[1].strip() for line in KEY_FILE.read_text(encoding="utf-8-sig").splitlines() if line.startswith("MODEL_API_KEY=")]
    if len(values) != 1 or not values[0]:
        raise ValueError("Expected one nonempty MODEL_API_KEY in the ignored local file")
    return values[0]


def get_cases(case_id):
    source = json.loads((CALIBRATION / "cases.json").read_text(encoding="utf-8"))
    cases = source["cases"]
    if case_id:
        cases = [case for case in cases if case["id"] == case_id]
        if not cases:
            raise ValueError("Unknown synthetic case ID")
    return cases


def validate_candidate(candidate, case):
    try:
        import jsonschema
    except ImportError:
        return {"json": True, "schema": "not_checked", "evidence": "not_checked", "statusMatchesExpected": candidate.get("status") == case["expected"]["status"]}

    schema = json.loads((CALIBRATION / "report.schema.json").read_text(encoding="utf-8"))
    errors = list(jsonschema.Draft202012Validator(schema).iter_errors(candidate))
    evidence_valid = True
    if candidate.get("status") == "ready":
        groups = candidate.get("commonGround", []) + candidate.get("differences", []) + candidate.get("togetherNextSteps", []) + candidate.get("uncertainties", [])
        advice = candidate.get("advice", {})
        groups += advice.get("A", []) + advice.get("B", [])
        for item in groups:
            for answer_id in item.get("evidence", []):
                try:
                    participant, dimension = answer_id.split(".")
                    if not (case["input"]["answers"][participant][dimension] or "").strip():
                        evidence_valid = False
                except (ValueError, KeyError, TypeError):
                    evidence_valid = False
    return {"json": True, "schema": not errors, "schemaErrorCount": len(errors), "evidence": evidence_valid, "statusMatchesExpected": candidate.get("status") == case["expected"]["status"]}


def run_one(key, system_prompt, case):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(case["input"], ensure_ascii=False)},
        ],
        "thinking": {"type": THINKING},
        "max_tokens": MAX_TOKENS,
        "stream": False,
    }
    request = urllib.request.Request(
        URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.load(response)
        choice = data["choices"][0]
        raw = choice["message"]["content"]
        record = {
            "httpStatus": 200,
            "modelReturned": data.get("model"),
            "systemFingerprint": data.get("system_fingerprint"),
            "finishReason": choice.get("finish_reason"),
            "usage": data.get("usage"),
            "rawOutput": raw,
        }
        try:
            candidate = json.loads(raw)
            record["candidate"] = candidate
            record["checks"] = validate_candidate(candidate, case)
        except (ValueError, TypeError):
            record["checks"] = {"json": False, "schema": False, "evidence": False, "statusMatchesExpected": False}
        return record
    except urllib.error.HTTPError as error:
        error.close()
        return {"httpStatus": error.code, "errorType": "HTTPError"}
    except Exception as error:
        return {"errorType": type(error).__name__}
    finally:
        elapsed = int((time.monotonic() - started) * 1000)
        print(f"{case['id']}: request finished in {elapsed}ms", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", help="one synthetic case ID")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.runs <= 5:
        raise ValueError("runs must be between 1 and 5")
    cases = get_cases(args.case)
    key = read_key()
    schema_bytes = (CALIBRATION / "report.schema.json").read_bytes()
    prompt_bytes = (CALIBRATION / "prompt.md").read_bytes()
    cases_bytes = (CALIBRATION / "cases.json").read_bytes()
    schema = json.loads(schema_bytes)
    prompt = prompt_bytes.decode("utf-8")
    system_prompt = prompt + "\n\nSTRICT_OUTPUT_JSON_SCHEMA=" + json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    results = {
        "kind": "synthetic_model_calibration",
        "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "modelRequested": MODEL,
        "endpoint": URL,
        "thinking": THINKING,
        "maxTokens": MAX_TOKENS,
        "promptVersion": "paired-report-v0.1",
        "promptSha256": hashlib.sha256(prompt_bytes).hexdigest(),
        "schemaSha256": hashlib.sha256(schema_bytes).hexdigest(),
        "casesSha256": hashlib.sha256(cases_bytes).hexdigest(),
        "questionsVersion": "paired-questions-v0.1",
        "casesVersion": "paired-cases-v0.1",
        "rubricVersion": "paired-rubric-v0.1",
        "results": [],
    }
    for case in cases:
        for run_number in range(1, args.runs + 1):
            print(f"Running {case['id']} #{run_number}/{args.runs}", flush=True)
            record = run_one(key, system_prompt, case)
            record.update({"caseId": case["id"], "run": run_number, "expectedStatus": case["expected"]["status"]})
            results["results"].append(record)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if record.get("httpStatus") not in (None, 200):
                print(f"HTTP status {record['httpStatus']}; stopping without retry", flush=True)
                return
    print(f"Saved {len(results['results'])} synthetic model result(s).", flush=True)


if __name__ == "__main__":
    main()
