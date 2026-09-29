# Streamlit Community Cloud runs this file. The React app is the whole
# interface; this process only publishes the built page and fills the window
# with it. Counselor login and student records stay in the browser, under
# Supabase row-level security, so this file has no database password.
from pathlib import Path
from urllib.parse import urlsplit
import shutil

import streamlit as st

ROOT = Path(__file__).resolve().parent
BUILT_PAGE = ROOT / "frontend" / "dist" / "index.html"
PUBLISHED_PAGE = ROOT / "static" / "index.html"

st.set_page_config(page_title="Guidance Student Records", layout="wide", initial_sidebar_state="collapsed")

# The component iframe is a fixed-height box. These rules remove Streamlit's
# own header and stretch that one frame to the window.
st.markdown(
    """
    <style>
      [data-testid="stHeader"],
      [data-testid="stToolbar"],
      [data-testid="stDecoration"],
      footer,
      #MainMenu,
      [data-testid="stSidebar"] {
        display: none !important;
        height: 0 !important;
      }
      html, body {
        height: 100%;
        margin: 0;
        overflow: hidden;
      }
      .stApp,
      [data-testid="stAppViewContainer"] {
        height: 100dvh !important;
        overflow: hidden !important;
      }
      [data-testid="stMain"],
      [data-testid="stMainBlockContainer"],
      .block-container,
      [data-testid="stVerticalBlock"],
      [data-testid="stVerticalBlockBorderWrapper"],
      [data-testid="element-container"],
      [data-testid="stIFrame"] {
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
        gap: 0 !important;
      }
      [data-testid="stMain"] iframe {
        display: block;
        position: absolute;
        inset: 0;
        height: 100% !important;
        width: 100% !important;
        border: 0 !important;
      }
      [data-testid="stMain"] {
        position: relative;
      }
    </style>
    """,
    unsafe_allow_html=True,
)


def frontend_src() -> str:
    page = st.context.url or ""
    path = urlsplit(page).path if page else ""
    if path and not path.endswith("/"):
        path += "/"
    return f"{path}app/static/index.html"


def publish_frontend() -> bool:
    if not BUILT_PAGE.is_file():
        return False
    PUBLISHED_PAGE.parent.mkdir(exist_ok=True)
    # Copy when the React build is newer so a redeploy picks up the new page
    # without serving a stale file from an earlier boot.
    if (not PUBLISHED_PAGE.is_file()) or BUILT_PAGE.stat().st_mtime > PUBLISHED_PAGE.stat().st_mtime:
        shutil.copyfile(BUILT_PAGE, PUBLISHED_PAGE)
    return True


if not publish_frontend():
    st.error(
        "The React build is missing. From the frontend folder run `npm run build`, "
        "then refresh. The built file should be frontend/dist/index.html."
    )
    st.stop()

# A real page on this origin can keep the Supabase session. An inline HTML
# frame cannot, because that frame has no stable origin for storage.
# The static folder has to exist when the server starts. Creating it here is
# too late for that check, so static/index.html is committed with the repo.
# The iframe path has to stay under the page the browser actually opened.
# A root path of /app/static/index.html skips Community Cloud's /~/+/ prefix
# and comes back as this same shell, so the frame loads forever.
st.iframe(frontend_src(), height="stretch")
