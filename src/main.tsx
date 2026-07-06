import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"

async function loadRuntimeConfig() {
  if (typeof window === "undefined") {
    return
  }

  if (import.meta.env.DEV) {
    window.__JASTI_RUNTIME_CONFIG__ = {
      apiUrl: import.meta.env.VITE_API_URL?.trim() || "",
    }
    return
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}runtime-config.php`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as { apiUrl?: string }
    window.__JASTI_RUNTIME_CONFIG__ = {
      apiUrl: payload.apiUrl?.trim() || "",
    }
  } catch {
    window.__JASTI_RUNTIME_CONFIG__ = window.__JASTI_RUNTIME_CONFIG__ ?? {}
  }
}

async function bootstrap() {
  await loadRuntimeConfig()
  const { default: App } = await import("./App.tsx")

  createRoot(document.getElementById("root")!).render(
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  )
}

void bootstrap()
