import logging
import time
import uuid

from starlette.types import ASGIApp, Receive, Scope, Send

log = logging.getLogger("contextforge.request")


class RequestIDMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        start = time.monotonic()
        method = scope.get("method", "")
        path = scope.get("path", "")

        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = int((time.monotonic() - start) * 1000)
            extra = {"request_id": request_id, "path": path, "duration_ms": duration_ms}

            if status_code >= 500:
                log.error("%s %s -> %d (%dms)", method, path, status_code, duration_ms, extra=extra)
            elif status_code >= 400:
                log.warning("%s %s -> %d (%dms)", method, path, status_code, duration_ms, extra=extra)
            else:
                log.info("%s %s -> %d (%dms)", method, path, status_code, duration_ms, extra=extra)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
