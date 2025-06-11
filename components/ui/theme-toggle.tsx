'use client';

import * as React from 'react';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';

export const ThemeToggle = React.memo(function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Function to get the appropriate icon based on current theme
  const getThemeIcon = React.useCallback(() => {
    switch (theme) {
      case 'light':
        return <Sun className="h-[1.2rem] w-[1.2rem] text-foreground" />;
      case 'dark':
        return <Moon className="h-[1.2rem] w-[1.2rem] text-foreground" />;
      case 'grey':
        return <Palette className="h-[1.2rem] w-[1.2rem] text-foreground" />;
      case 'system':
        return <Monitor className="h-[1.2rem] w-[1.2rem] text-foreground" />;
      default:
        return <Sun className="h-[1.2rem] w-[1.2rem] text-foreground" />;
    }
  }, [theme]);

  const handleThemeChange = React.useCallback((newTheme: 'light' | 'dark' | 'grey' | 'system') => {
    setTheme(newTheme);
  }, [setTheme]);

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-9 h-9 p-0 bg-background border-border hover:bg-muted">
            {getThemeIcon()}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          side="bottom"
          sideOffset={2}
          className="min-w-32 bg-background border-border text-foreground shadow-lg"
        >
        <DropdownMenuItem 
          onClick={() => handleThemeChange('light')}
          className={`text-foreground hover:bg-muted cursor-pointer ${theme === 'light' ? 'bg-muted' : ''}`}
        >
          <Sun className="mr-2 h-4 w-4 text-foreground" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange('dark')}
          className={`text-foreground hover:bg-muted cursor-pointer ${theme === 'dark' ? 'bg-muted' : ''}`}
        >
          <Moon className="mr-2 h-4 w-4 text-foreground" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange('grey')}
          className={`text-foreground hover:bg-muted cursor-pointer ${theme === 'grey' ? 'bg-muted' : ''}`}
        >
          <Palette className="mr-2 h-4 w-4 text-foreground" />
          <span>Grey</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleThemeChange('system')}
          className={`text-foreground hover:bg-muted cursor-pointer ${theme === 'system' ? 'bg-muted' : ''}`}
        >
          <Monitor className="mr-2 h-4 w-4 text-foreground" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}); 