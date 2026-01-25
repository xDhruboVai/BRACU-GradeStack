#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARSER_DIR = ROOT / 'parser_py'
if str(PARSER_DIR) not in sys.path:
    sys.path.insert(0, str(PARSER_DIR))

try:
    from utils_parser import extract  
except Exception as e:
    print(json.dumps({"error": f"Import failed: {e}"}))
    sys.exit(1)


def build_attempts(semesters_done: dict, skipped_attempts: list[dict]) -> list[dict]:
    ordered_semesters = [s for s in semesters_done.keys() if s != "NULL"]
    attempts_map: dict[str, list[dict]] = {}

    skipped_by_sem: dict[str, list[dict]] = {}
    for att in skipped_attempts:
        skipped_by_sem.setdefault(att.get("semester"), []).append(att)

    for sem_name in ordered_semesters:
        for att in skipped_by_sem.get(sem_name, []):
            attempts_map.setdefault(att["course_code"], []).append({
                "semester": sem_name,
                "course_code": att["course_code"],
                "grade": att["grade"],
                "gpa": 0.0,
                "credit": att.get("credit", 3),
            })
        for node in semesters_done[sem_name].courses:
            attempts_map.setdefault(node.course, []).append({
                "semester": sem_name,
                "course_code": node.course,
                "grade": node.grade,
                "gpa": node.gpa,
                "credit": node.credit,
            })

    ordered_attempts: list[dict] = []
    for course_code, arr in attempts_map.items():
        total = len(arr)
        for idx, att in enumerate(arr, start=1):
            att["attempt_no"] = idx
            att["is_retake"] = idx > 1
            att["is_latest"] = idx == total
            ordered_attempts.append(att)
    return ordered_attempts


def to_json_payload(name: str | None, student_id: str | None, semesters_done: dict, attempts: list[dict]) -> dict:
    ordered_semesters = [s for s in semesters_done.keys() if s != "NULL"]
    payload = {
        "profile": {"full_name": name, "student_id": student_id},
        "semesters": [],
        "course_attempts": attempts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    for i, sem_name in enumerate(ordered_semesters):
        sem = semesters_done[sem_name]
        payload["semesters"].append({
            "name": sem.semester,
            "term_index": i,
            "term_gpa": sem.gpa,
            "term_credits": sem.credit,
            "cumulative_cgpa": sem.cgpa,
        })
    return payload


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_to_json.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"PDF not found: {pdf_path}"}))
        sys.exit(1)

    try:
        try:
            name, student_id, courses_done, semesters_done, skipped_attempts = extract(pdf_path)
        except ValueError:
            name, student_id, courses_done, semesters_done = extract(pdf_path)
            skipped_attempts = []

        attempts = build_attempts(semesters_done, skipped_attempts)
        result = to_json_payload(name, student_id, semesters_done, attempts)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
