import * as React from "react"
import templateBackImage from "@/assets/template-back-fit.jpeg"

type IdCardBackPreviewProps = {
  size?: "compact" | "full"
  forceScale?: number
}

const TEMPLATE_WIDTH = 1019
const TEMPLATE_HEIGHT = 659

function toPx(value: number) {
  return `${value}px`
}

export function IdCardBackPreview({ size = "full", forceScale }: IdCardBackPreviewProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = React.useState(forceScale ?? 1)

  React.useEffect(() => {
    if (typeof forceScale === "number" && Number.isFinite(forceScale) && forceScale > 0) {
      setScale(forceScale)
      return
    }

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const syncScale = () => {
      const nextScale = wrapper.clientWidth / TEMPLATE_WIDTH
      if (Number.isFinite(nextScale) && nextScale > 0) {
        setScale(nextScale)
      }
    }

    syncScale()
    window.addEventListener("resize", syncScale)
    window.addEventListener("beforeprint", syncScale)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(syncScale)
      observer.observe(wrapper)
    }

    return () => {
      window.removeEventListener("resize", syncScale)
      window.removeEventListener("beforeprint", syncScale)
      observer?.disconnect()
    }
  }, [])

  const wrapperMaxWidthClass =
    size === "compact" ? "max-w-full sm:max-w-[620px]" : "max-w-full sm:max-w-[820px]"
  const scaledHeight = TEMPLATE_HEIGHT * scale

  return (
    <div ref={wrapperRef} className={`mx-auto w-full ${wrapperMaxWidthClass}`}>
      <div className="relative w-full overflow-hidden" style={{ height: toPx(scaledHeight) }}>
        <div
          data-id-card-canvas="true"
          className="absolute left-0 top-0 origin-top-left overflow-hidden bg-white"
          style={{
            width: toPx(TEMPLATE_WIDTH),
            height: toPx(TEMPLATE_HEIGHT),
            transform: `scale(${scale})`,
          }}
        >
          <img
            src={templateBackImage}
            alt="Student ID back template"
            className="absolute inset-0 block h-full w-full object-fill"
          />
        </div>
      </div>
    </div>
  )
}
