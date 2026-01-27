interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md p-6">
        <h2 className="text-2xl font-bold mb-4">页面出错了</h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
}
