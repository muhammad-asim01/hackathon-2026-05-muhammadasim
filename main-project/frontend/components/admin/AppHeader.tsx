import { type Session } from "next-auth";
import { UserMenu } from "./UserMenu";

interface AppHeaderProps {
  session: Session;
  title?: string;
}

export function AppHeader({ session, title }: AppHeaderProps) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div>
        {title && (
          <p className="text-sm font-medium text-foreground">{title}</p>
        )}
      </div>
      <UserMenu session={session} />
    </header>
  );
}
