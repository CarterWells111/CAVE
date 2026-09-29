"""Offline structural/provenance checks for the synthetic paired-room draft."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / "docs" / "calibration" / "paired-room"
DIMENSIONS = ("expectation", "concern", "boundary", "response_next_step")
SCENARIOS = ("first-overnight", "pause", "adjust")
PAUSE_MESSAGE = "这次暂不生成共同报告。请先在各自安全、自在的条件下决定是否继续使用；不需要为了完成报告而继续讨论。"
INSUFFICIENT_MESSAGE = "目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。"


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def check():
    questions = load("questions.json")
    cases = load("cases.json")
    schema = load("report.schema.json")
    assert questions["version"] == "paired-questions-v0.1"
    assert questions["dimensions"] == list(DIMENSIONS)
    assert [item["id"] for item in questions["scenarios"]] == list(SCENARIOS)
    for scenario in questions["scenarios"]:
        assert tuple(scenario["questions"]) == DIMENSIONS
        assert all(20 <= len(text) <= 140 for text in scenario["questions"].values())

    assert cases["authorship"] == "manual_synthetic_expectations_not_model_outputs"
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert len(cases["cases"]) == 8
    assert len({item["id"] for item in cases["cases"]}) == 8
    counts = {"ready": 0, "paused": 0, "insufficient": 0}
    covered = set()
    for sample in cases["cases"]:
        sample_id = sample["id"]
        incoming = sample["input"]
        output = sample["expected"]
        scenario_id = incoming["scenarioId"]
        assert scenario_id in SCENARIOS, sample_id
        covered.add(scenario_id)
        assert tuple(incoming["consent"]) == ("A", "B"), sample_id
        assert tuple(incoming["answers"]) == ("A", "B"), sample_id
        for participant in ("A", "B"):
            assert isinstance(incoming["consent"][participant], bool), sample_id
            answers = incoming["answers"][participant]
            assert tuple(answers) == DIMENSIONS, sample_id
            assert all(value is None or isinstance(value, str) for value in answers.values()), sample_id
        assert output["version"] == "paired-report-v0.1", sample_id
        assert output["scenarioId"] == scenario_id, sample_id
        assert output["status"] in counts, sample_id
        counts[output["status"]] += 1

        if output["status"] == "paused":
            assert tuple(output) == ("version", "scenarioId", "status", "message"), sample_id
            assert output["message"] == PAUSE_MESSAGE, sample_id
            assert sample["privateReviewLabel"] in ("coercion", "violence", "cannot_refuse", "uncertain_safety"), sample_id
            continue
        if output["status"] == "insufficient":
            assert tuple(output) == ("version", "scenarioId", "status", "message"), sample_id
            assert output["message"] == INSUFFICIENT_MESSAGE, sample_id
            continue

        assert tuple(output) == ("version", "scenarioId", "status", "commonGround", "differences", "advice", "togetherNextSteps", "uncertainties"), sample_id
        assert tuple(output["advice"]) == ("A", "B"), sample_id
        groups = {
            "commonGround": output["commonGround"],
            "differences": output["differences"],
            "advice.A": output["advice"]["A"],
            "advice.B": output["advice"]["B"],
            "togetherNextSteps": output["togetherNextSteps"],
            "uncertainties": output["uncertainties"],
        }
        for name, items in groups.items():
            limit = 3 if name in ("commonGround", "differences", "uncertainties") else 2
            assert 1 <= len(items) <= limit, f"{sample_id}:{name}"
            for item in items:
                evidence = item["evidence"]
                assert 1 <= len(evidence) <= 4 and len(set(evidence)) == len(evidence), f"{sample_id}:{name}"
                for answer_id in evidence:
                    participant, dimension = answer_id.split(".")
                    assert participant in ("A", "B") and dimension in DIMENSIONS, f"{sample_id}:{answer_id}"
                    assert (incoming["answers"][participant][dimension] or "").strip(), f"{sample_id}:{answer_id} points to a blank answer"
                for key in ("text", "say", "do"):
                    if key in item:
                        text = item[key]
                        max_length = 80 if name in ("commonGround", "differences") else 60
                        assert isinstance(text, str) and 1 <= len(text) <= max_length, f"{sample_id}:{name}.{key}"
                if name in ("commonGround", "differences"):
                    assert any(x.startswith("A.") for x in evidence) and any(x.startswith("B.") for x in evidence), f"{sample_id}:{name}"
    assert covered == set(SCENARIOS)
    assert counts == {"ready": 4, "paused": 3, "insufficient": 1}
    print(f"Paired-room calibration: {len(cases['cases'])} synthetic cases passed structural/provenance checks.")


if __name__ == "__main__":
    check()
