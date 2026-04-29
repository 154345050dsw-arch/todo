import { ArrowRight } from "lucide-react";

export function InteractiveHoverButton({
  text = "Button",
  icon,
  className = "",
  ...props
}) {
  return (
    <button
      className={[
        "group relative w-32 cursor-pointer overflow-hidden rounded-full border bg-background px-6 py-2 text-center font-semibold",
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
        {text}
      </span>
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-primary text-primary-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 rounded-full">
        <span>{text}</span>
        {icon || <ArrowRight className="h-4 w-4" />}
      </div>
    </button>
  );
}
