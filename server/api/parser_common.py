import io
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib import parse as urlparse
from urllib import request as urlrequest

try:
    import cgi
except Exception:
    cgi = None

ROOT = Path(__file__).resolve().parents[1]
PARSER_DIR = ROOT / "parser_py"
if str(PARSER_DIR) not in sys.path:
    sys.path.insert(0, str(PARSER_DIR))

from utils_parser import extract  # noqa: E402


def _json_response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def ok(payload):
    return _json_response(200, payload)


def created(payload):
    return _json_response(201, payload)


def bad_request(message, details=None):
    out = {"error": message}
    if details:
        out["details"] = details
    return _json_response(400, out)


def server_error(message, details=None):
    out = {"error": message}
    if details:
        out["details"] = details
    return _json_response(500, out)


def _read_request_body(req):
    body = getattr(req, "body", None)
    if isinstance(body, (bytes, bytearray)):
        return bytes(body)

    get_data = getattr(req, "get_data", None)
    if callable(get_data):
        data = get_data()
        if isinstance(data, str):
            return data.encode("utf-8")
        return bytes(data or b"")

    data_attr = getattr(req, "data", None)
    if isinstance(data_attr, str):
        return data_attr.encode("utf-8")
    if isinstance(data_attr, (bytes, bytearray)):
        return bytes(data_attr)

    return b""


def _request_headers(req):
    headers = getattr(req, "headers", {}) or {}
    lowered = {}
    for k, v in headers.items():
        lowered[str(k).lower()] = v
    return lowered


def parse_multipart_form(req):
    if cgi is None:
        return None, {}, "Python cgi module unavailable"

    headers = _request_headers(req)
    content_type = str(headers.get("content-type", ""))
    if "multipart/form-data" not in content_type:
        return None, {}, "Expected multipart/form-data"

    raw = _read_request_body(req)
    env = {
        "REQUEST_METHOD": str(getattr(req, "method", "POST") or "POST"),
        "CONTENT_TYPE": content_type,
        "CONTENT_LENGTH": str(len(raw)),
    }

    form = cgi.FieldStorage(
        fp=io.BytesIO(raw),
        environ=env,
        keep_blank_values=True,
    )

    file_item = form["file"] if "file" in form else None
    fields = {}
    if hasattr(form, "keys"):
        for key in form.keys():
            if key == "file":
                continue
            fields[key] = form.getvalue(key)

    return file_item, fields, None


def parse_pdf_to_payload(pdf_bytes):
    if not pdf_bytes:
        raise ValueError("No file uploaded")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        try:
            name, student_id, _courses_done, semesters_done, skipped_attempts = extract(tmp_path)
        except ValueError:
            name, student_id, _courses_done, semesters_done = extract(tmp_path)
            skipped_attempts = []
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    attempts = build_attempts(semesters_done, skipped_attempts)
    return to_json_payload(name, student_id, semesters_done, attempts)


def build_attempts(semesters_done, skipped_attempts):
    ordered_semesters = [s for s in semesters_done.keys() if s != "NULL"]
    attempts_map = {}

    skipped_by_sem = {}
    for att in skipped_attempts:
        skipped_by_sem.setdefault(att.get("semester"), []).append(att)

    for sem_name in ordered_semesters:
        for att in skipped_by_sem.get(sem_name, []):
            attempts_map.setdefault(att["course_code"], []).append(
                {
                    "semester": sem_name,
                    "course_code": att["course_code"],
                    "grade": att["grade"],
                    "gpa": 0.0,
                    "credit": att.get("credit", 3),
                }
            )

        for node in semesters_done[sem_name].courses:
            attempts_map.setdefault(node.course, []).append(
                {
                    "semester": sem_name,
                    "course_code": node.course,
                    "grade": node.grade,
                    "gpa": node.gpa,
                    "credit": node.credit,
                }
            )

    ordered_attempts = []
    for _course_code, arr in attempts_map.items():
        total = len(arr)
        for idx, att in enumerate(arr, start=1):
            att["attempt_no"] = idx
            att["is_retake"] = idx > 1
            att["is_latest"] = idx == total
            ordered_attempts.append(att)

    return ordered_attempts


def to_json_payload(name, student_id, semesters_done, attempts):
    ordered_semesters = [s for s in semesters_done.keys() if s != "NULL"]

    payload = {
        "profile": {"full_name": name, "student_id": student_id},
        "semesters": [],
        "course_attempts": attempts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    for i, sem_name in enumerate(ordered_semesters):
        sem = semesters_done[sem_name]
        payload["semesters"].append(
            {
                "name": sem.semester,
                "term_index": i,
                "term_gpa": sem.gpa,
                "term_credits": sem.credit,
                "cumulative_cgpa": sem.cgpa,
            }
        )

    return payload


class SupabaseRestClient:
    def __init__(self):
        self.base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""

        if not self.base or not self.key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    def _headers(self, extra=None):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method, table, query=None, body=None, prefer=None):
        query = query or {}
        qs = urlparse.urlencode(query)
        url = f"{self.base}/rest/v1/{table}"
        if qs:
            url = f"{url}?{qs}"

        headers = self._headers()
        if prefer:
            headers["Prefer"] = prefer

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        req = urlrequest.Request(url, data=data, method=method, headers=headers)

        try:
            with urlrequest.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                if not raw.strip():
                    return None
                return json.loads(raw)
        except Exception as err:
            detail = None
            if hasattr(err, "read"):
                try:
                    detail = err.read().decode("utf-8")
                except Exception:
                    detail = str(err)
            raise RuntimeError(detail or str(err))

    def upsert_profile(self, user_id, full_name, student_id):
        now_iso = datetime.now(timezone.utc).isoformat()
        body = {
            "user_id": user_id,
            "full_name": full_name,
            "student_id": student_id,
            "last_parsed_at": now_iso,
        }
        self._request(
            "POST",
            "user_profiles",
            query={"on_conflict": "user_id"},
            body=body,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def delete_user_rows(self, table, user_id):
        self._request("DELETE", table, query={"user_id": f"eq.{user_id}"})

    def insert_semesters(self, semesters):
        if not semesters:
            return []
        return self._request(
            "POST",
            "semesters",
            query={"select": "id,name,term_index"},
            body=semesters,
            prefer="return=representation",
        ) or []

    def insert_attempts_chunk(self, attempts_chunk):
        if not attempts_chunk:
            return
        self._request(
            "POST",
            "course_attempts",
            body=attempts_chunk,
            prefer="return=minimal",
        )
