import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--popover-foreground)",
          "--description-color": "var(--muted-foreground)",
          "--error-bg": "hsl(var(--destructive))",
          "--error-border": "hsl(var(--destructive))",
          "--error-text": "hsl(var(--destructive-foreground))",
          "--success-bg": "hsl(var(--primary))",
          "--success-border": "hsl(var(--primary))",
          "--success-text": "hsl(var(--primary-foreground))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
