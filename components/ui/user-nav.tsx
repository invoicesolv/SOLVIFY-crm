import { User } from "lucide-react";

export function UserNav() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center">
        <User className="h-4 w-4 text-neutral-400" />
      </div>
    </div>
  );
} 