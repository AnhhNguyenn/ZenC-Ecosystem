import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from config import settings

T = TypeVar("T")


async def await_with_timeout(
    awaitable: Awaitable[T],
    operation: str,
    timeout_seconds: float | None = None,
) -> T:
    timeout = timeout_seconds or settings.AI_PROVIDER_TIMEOUT_SECONDS
    try:
        return await asyncio.wait_for(awaitable, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"{operation} timed out after {timeout} seconds"
        ) from exc


async def call_blocking_with_timeout(
    operation: str,
    fn: Callable[..., T],
    *args,
    timeout_seconds: float | None = None,
    **kwargs,
) -> T:
    timeout = timeout_seconds or settings.AI_PROVIDER_TIMEOUT_SECONDS
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(fn, *args, **kwargs),
            timeout=timeout,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"{operation} timed out after {timeout} seconds"
        ) from exc
