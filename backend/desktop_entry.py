import multiprocessing
import os

import uvicorn


def main() -> None:
    port = int(os.environ.get("NOVEL_BACKEND_PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
