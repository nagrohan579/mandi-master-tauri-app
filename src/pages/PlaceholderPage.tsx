import { useLocation } from "react-router-dom";

export function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop() || 'page';

  const formatPageName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          {formatPageName(pageName)}
        </h1>
        <p className="text-muted-foreground">
          This page is under development. Content will be added soon.
        </p>
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Current route: <code className="bg-background px-2 py-1 rounded">{location.pathname}</code>
          </p>
        </div>
      </div>
    </div>
  );
}