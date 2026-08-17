export function LoadingSpinner({ text = "Cargando datos..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
