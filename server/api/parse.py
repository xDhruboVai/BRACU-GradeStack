from parser_common import bad_request, ok, parse_multipart_form, server_error, parse_pdf_to_payload


def handler(request):
    try:
        file_item, _fields, form_err = parse_multipart_form(request)
        if form_err:
            return bad_request(form_err)

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
        return ok(parsed)
    except Exception as err:
        return server_error("Parser failed", str(err))
