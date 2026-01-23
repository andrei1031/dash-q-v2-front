import { useTheme } from "../hooks/useTheme";
import { IconMoon, IconSun } from "../assets/Icon";

export const ThemeToggleButton = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button 
            onClick={toggleTheme} 
            className="btn btn-icon" 
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
        </button>
    );
}
