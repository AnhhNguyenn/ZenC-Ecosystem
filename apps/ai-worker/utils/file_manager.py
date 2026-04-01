import tempfile
import logging
import os

logger = logging.getLogger(__name__)

class ManagedTempFile:
    """Utility class to safely handle physical temp files for future ML models (like Whisper C++ or FFmpeg)."""
    def __init__(self, data: bytes, suffix: str = ".wav"):
        self.data = data
        self.suffix = suffix
        self.file = None

    def __enter__(self):
        # Auto-create and write to file
        self.file = tempfile.NamedTemporaryFile(delete=True, suffix=self.suffix)
        self.file.write(self.data)
        self.file.flush() # Force write to disk
        logger.debug(f"Created temp file at {self.file.name}")
        return self.file.name

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Auto-delete on exit block
        if self.file:
            name = self.file.name
            self.file.close()
            # Double check deletion in case of weird OS locks
            if os.path.exists(name):
                try:
                    os.remove(name)
                except OSError as e:
                    logger.warning(f"Failed to force remove temp file {name}: {e}")
            logger.debug(f"Auto-deleted temp file at {name}")
