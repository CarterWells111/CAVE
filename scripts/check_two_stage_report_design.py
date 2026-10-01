"""Static review checks and deterministic sample rendering; never calls a model."""

import hashlib
import json
from pathlib import Path

import jsonschema


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "docs" / "calibration" / "paired-room"
DESIGN = BASE / "two-stage"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def lookup_case(case):
    if "input" in case:
        return case["input"]
    relative, case_id = case["inputRef"].split("#", 1)
    source = read((DESIGN / relative).resolve())
    return next(item["input"] for item in source["cases"] if item["id"] == case_id)


def check_cases(cases, catalog):
    codes = {item["code"]: item for item in catalog["factCodes"]}
    require(len(codes) == len(catalog["factCodes"]), "duplicate catalog code")
    require(len({case["id"] for case in cases["cases"]}) == len(cases["cases"]), "duplicate case ID")
    for case in cases["cases"]:
        source = lookup_case(case)
        require(source["scenarioId"] in ("first-overnight", "pause", "adjust"), case["id"])
        expected = case["expected"]
        require(expected["status"] in ("ready", "paused", "insufficient"), case["id"])
        for fact in expected.get("requiredFacts", []):
            require(fact["code"] in codes, f"unknown code in {case['id']}")
            require(fact["scope"] in codes[fact["code"]]["allowedScopes"], f"invalid scope in {case['id']}")
            require(fact["owner"] in ("A", "B"), case["id"])
        for relation in expected.get("requiredRelations", []):
            a, b = relation["codes"]
            require(a in codes and b in codes, f"unknown relation code in {case['id']}")
            require(codes[a]["topic"] == codes[b]["topic"], f"cross-topic relation in {case['id']}")
            if relation["kind"] == "shared":
                require(a == b and "sharedDisplay" in codes[a], f"invalid shared relation in {case['id']}")
            elif relation["kind"] == "compatible":
                require([a, b] in catalog["compatiblePairs"] or [b, a] in catalog["compatiblePairs"], f"unapproved compatible relation in {case['id']}")
            else:
                require(relation["kind"] == "different" and a != b, f"invalid difference in {case['id']}")
                require([a, b] not in catalog["compatiblePairs"] and [b, a] not in catalog["compatiblePairs"], f"compatible facts mislabeled different in {case['id']}")
        for code in expected.get("forbiddenSharedCodes", []) + expected.get("forbiddenOneSidedOpenCodes", []):
            require(code in codes, f"unknown forbidden code in {case['id']}")
    return codes


def check_ledger(ledger, source, codes, catalog):
    jsonschema.validate(ledger, read(DESIGN / "fact-ledger.schema.json"))
    require(ledger["status"] == "ready", "sample ledger is not ready")
    facts = {fact["id"]: fact for fact in ledger["facts"]}
    require(len(facts) == len(ledger["facts"]), "duplicate fact ID")
    for fact in facts.values():
        owner, field = fact["answerId"].split(".", 1)
        require(owner == fact["owner"], "answer owner mismatch")
        require(fact["sourceSpan"] in source["answers"][owner][field], "source span absent")
        require(fact["code"] in codes, "unknown fact code")
        require(fact["scope"] in codes[fact["code"]]["allowedScopes"], "invalid fact scope")
    relations = {relation["id"]: relation for relation in ledger["relations"]}
    require(len(relations) == len(ledger["relations"]), "duplicate relation ID")
    for relation in relations.values():
        left, right = (facts[id] for id in relation["factIds"])
        require({left["owner"], right["owner"]} == {"A", "B"}, "relation lacks both sides")
        a, b = left["code"], right["code"]
        require(codes[a]["topic"] == codes[b]["topic"] == relation["topic"], "relation topic mismatch")
        if relation["kind"] == "shared":
            require(a == b and "sharedDisplay" in codes[a], "invalid shared relation")
            reciprocal = {left["scope"], right["scope"]} == {"when_owner_pauses", "when_other_pauses"}
            allowed_reciprocal = any(item["code"] == a and set(item["scopes"]) == {left["scope"], right["scope"]} for item in catalog["sharedScopePairs"])
            require(left["scope"] == right["scope"] or reciprocal and allowed_reciprocal, "shared scope mismatch")
        elif relation["kind"] == "compatible":
            require([a, b] in catalog["compatiblePairs"] or [b, a] in catalog["compatiblePairs"], "unapproved compatibility")
        else:
            require(a != b, "difference repeats the same fact code")
            require([a, b] not in catalog["compatiblePairs"] and [b, a] not in catalog["compatiblePairs"], "compatible facts mislabeled different")
    return facts, relations


def render_sample(ledger, plan, facts, relations, codes, catalog, templates, display_names=None):
    jsonschema.validate(plan, read(DESIGN / "report-plan.schema.json"))
    require(plan["ledgerSha256"] == canonical_sha(ledger), "ledger hash mismatch")
    require(plan["catalogSha256"] == canonical_sha(catalog), "catalog hash mismatch")
    require(plan["templatesSha256"] == canonical_sha(templates), "template hash mismatch")
    require(plan["scenarioId"] == ledger["scenarioId"], "scenario mismatch")

    # Internal A/B IDs are stable; display names are renderer-only values.
    display_names = display_names or {"A": "A", "B": "B"}
    require(set(display_names) == {"A", "B"} and all(display_names.values()), "invalid display names")

    def display(fact):
        template = codes[fact["code"]]["display"]
        require(template is not None, "unrenderable fact")
        side = fact["owner"]
        other = "B" if side == "A" else "A"
        return template.replace("{side}", display_names[side]).replace("{other}", display_names[other])

    def relation_text(relation):
        left, right = sorted((facts[id] for id in relation["factIds"]), key=lambda fact: fact["owner"])
        if relation["kind"] == "shared":
            shared = codes[left["code"]]["sharedDisplay"]
            return templates["relationSentences"]["shared"].replace("{sharedDisplay}", shared)
        value = templates["relationSentences"][relation["kind"]]
        return value.replace("{leftDisplay}", display(left)).replace("{rightDisplay}", display(right))

    selected = plan["sections"]
    common_ids = selected["commonAndDifferences"]["sharedOrCompatibleRelationIds"] + selected["commonAndDifferences"]["differentRelationIds"]
    require(all(id in relations for id in common_ids), "missing common relation")
    require(all(relations[id]["kind"] in ("shared", "compatible") for id in selected["commonAndDifferences"]["sharedOrCompatibleRelationIds"]), "wrong common relation kind")
    require(all(relations[id]["kind"] == "different" for id in selected["commonAndDifferences"]["differentRelationIds"]), "wrong difference kind")
    common = "".join(relation_text(relations[id]) for id in common_ids)

    advice_ids = selected["adviceForBoth"]["discussionRelationIds"]
    require(all(id in relations for id in advice_ids), "missing discussion relation")
    topic = relations[advice_ids[0]]["topic"]
    cautions = {item["code"]: item for item in catalog["cautionTemplates"]}
    for code in selected["adviceForBoth"]["cautionCodes"]:
        require(ledger["scenarioId"] in cautions[code]["allowedScenarios"], "caution used in wrong scenario")
    advice = templates["discussionIntroByTopic"][topic] + "".join(cautions[code]["text"] for code in selected["adviceForBoth"]["cautionCodes"])

    action_codes = {item["code"]: item for item in catalog["actionTemplates"]}
    for code in selected["nextSteps"]["actionCodes"]:
        action = action_codes[code]
        require(ledger["scenarioId"] in action["allowedScenarios"], "action used in wrong scenario")
        if "requiredSharedCode" in action:
            require(any(relation["kind"] == "shared" and facts[relation["factIds"][0]]["code"] == action["requiredSharedCode"] for relation in relations.values()), "action lacks shared prerequisite")
        if "requiredTopic" in action:
            require(any(relation["topic"] == action["requiredTopic"] for relation in relations.values()), "action lacks topic prerequisite")
    steps = "".join(action_codes[code]["text"] for code in selected["nextSteps"]["actionCodes"])
    boundary_ids = selected["nextSteps"]["boundaryFactIds"]
    require(all(id in facts for id in boundary_ids), "missing boundary fact")
    require(all(facts[id]["code"] in catalog["boundaryCodeAllowlist"] for id in boundary_ids), "non-boundary fact selected")
    steps += "".join(templates["boundarySentence"].replace("{factDisplay}", display(facts[id])) for id in boundary_ids)
    require(not selected["nextSteps"]["openItemIds"], "sample intentionally has no open item")
    steps += templates["noOpenFallback"]

    def evidence(relation_ids, extra_fact_ids=()):
        fact_ids = [id for relation_id in relation_ids for id in relations[relation_id]["factIds"]] + list(extra_fact_ids)
        return list(dict.fromkeys(facts[id]["answerId"] for id in fact_ids))

    result = {
        "version": "paired-report-v0.2", "scenarioId": ledger["scenarioId"], "status": "ready",
        "sections": {
            "commonAndDifferences": {"text": common, "evidence": evidence(common_ids)},
            "adviceForBoth": {"text": advice, "evidence": evidence(advice_ids + ["r1"])},
            "nextSteps": {"text": steps, "evidence": evidence(["r1"], boundary_ids)},
        },
    }
    jsonschema.validate(result, read(BASE / "report.schema.json"))
    require(all("\n" not in item["text"] for item in result["sections"].values()), "extra paragraph")
    require(sum(len(item["text"]) for item in result["sections"].values()) <= 660, "report too long")
    return result


def main():
    catalog = read(DESIGN / "fact-catalog.json")
    cases = read(DESIGN / "cases.json")
    codes = check_cases(cases, catalog)
    sample_case = next(case for case in cases["cases"] if case["id"] == "pause-original")
    ledger = read(DESIGN / "example-pause-ledger.json")
    facts, relations = check_ledger(ledger, lookup_case(sample_case), codes, catalog)
    plan = read(DESIGN / "example-pause-plan.json")
    templates = read(DESIGN / "render-templates.json")
    result = render_sample(ledger, plan, facts, relations, codes, catalog, templates)
    require(read(DESIGN / "example-pause-report.json") == result, "example report differs from fixed-template rendering")
    overview = (DESIGN / "README.md").read_text(encoding="utf-8")
    require(all(section["text"] in overview for section in result["sections"].values()), "README example differs from rendered report")
    labeled = render_sample(ledger, plan, facts, relations, codes, catalog, templates, {"A": "发起人", "B": "受邀者"})
    require("发起人" in labeled["sections"]["commonAndDifferences"]["text"] and "受邀者" in labeled["sections"]["commonAndDifferences"]["text"], "display name mapping failed")
    print(f"Two-stage design: {len(cases['cases'])} synthetic expectations and one deterministic report example passed static checks.")


if __name__ == "__main__":
    main()
