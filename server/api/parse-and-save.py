from parser_common import (
    bad_request,
    ok,
    parse_multipart_form,
    parse_pdf_to_payload,
    server_error,
    SupabaseRestClient,
)


def _to_int_credit(value):
    try:
        if value is None:
            return None
        return int(float(value))
    except Exception:
        return None


def handler(request):
    try:
        file_item, fields, form_err = parse_multipart_form(request)
        if form_err:
            return bad_request(form_err)

        user_id = (fields.get("userId") or "").strip()
        if not user_id:
            return bad_request("Missing userId")
        if not file_item:
            return bad_request("No file uploaded")

        mimetype = (getattr(file_item, "type", "") or "").lower()
        if mimetype and mimetype != "application/pdf":
            return bad_request("Only PDF files are allowed")

        pdf_bytes = file_item.file.read() if getattr(file_item, "file", None) else b""
        if not pdf_bytes:
            return bad_request("Uploaded file is empty")

        parsed = parse_pdf_to_payload(pdf_bytes)
        if parsed.get("error"):
            return bad_request(parsed.get("error"))

        profile = parsed.get("profile") or {}
        semesters = parsed.get("semesters") if isinstance(parsed.get("semesters"), list) else []
        attempts = parsed.get("course_attempts") if isinstance(parsed.get("course_attempts"), list) else []

        norm_semesters = []
        for s in semesters:
            norm_semesters.append(
                {
                    "user_id": user_id,
                    "name": str(s.get("name") or "").strip(),
                    "term_index": s.get("term_index", 0),
                    "term_gpa": s.get("term_gpa"),
                    "term_credits": s.get("term_credits"),
                    "cumulative_cgpa": s.get("cumulative_cgpa"),
                }
            )

        db = SupabaseRestClient()
        db.upsert_profile(
            user_id=user_id,
            full_name=profile.get("full_name"),
            student_id=profile.get("student_id"),
        )

        db.delete_user_rows("course_attempts", user_id)
        db.delete_user_rows("semesters", user_id)

        sem_rows = db.insert_semesters(norm_semesters)
        sem_id_map = {}
        for row in sem_rows:
            sem_id_map[str(row.get("name") or "").strip()] = row.get("id")

        attempt_records = []
        for att in attempts:
            sem_name = str(att.get("semester") or "").strip()
            attempt_records.append(
                {
                    "user_id": user_id,
                    "semester_id": sem_id_map.get(sem_name),
                    "course_code": att.get("course_code"),
                    "grade": att.get("grade"),
                    "gpa": att.get("gpa"),
                    "credit": _to_int_credit(att.get("credit")),
                    "attempt_no": att.get("attempt_no") or 1,
                    "is_retake": bool(att.get("is_retake")),
                    "is_latest": bool(att.get("is_latest")),
                }
            )

        chunk_size = 500
        for i in range(0, len(attempt_records), chunk_size):
            chunk = attempt_records[i : i + chunk_size]
            db.insert_attempts_chunk(chunk)

        return ok(
            {
                "success": True,
                "profile": {
                    "full_name": profile.get("full_name"),
                    "student_id": profile.get("student_id"),
                },
                "semesters_inserted": len(norm_semesters),
                "attempts_inserted": len(attempt_records),
            }
        )
    except Exception as err:
        return server_error("parse-and-save failed", str(err))
